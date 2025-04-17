// font to base64

const mimeTypes = {
    eot: { mime: 'application/vnd.ms-fontobject', format: "format('embedded-opentype')" },
    woff: { mime: 'font/woff', format: "format('woff')" },
    woff2: { mime: 'font/woff2', format: "format('woff2')" },
    ttf: { mime: 'font/ttf', format: "format('truetype')" },
    otf: { mime: 'font/otf', format: "format('opentype')" },
    svg: { mime: 'image/svg+xml', format: "format('svg')" }
};

async function getFontBase64Src(url) {
    const path = new URL(url).pathname;
    const extension = path.split('.').pop().toLowerCase();
    const mimeInfo = mimeTypes[extension];
    if (!mimeInfo) throw new Error(`Unsupported font type: ${extension}`);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Font fetch failed: ${response.status}`);
    const buffer = await response.arrayBuffer();

    const base64 = btoa(new Uint8Array(buffer).reduce(
        (data, byte) => data + String.fromCharCode(byte), ''
    ));

    return `url('data:${mimeInfo.mime};charset=utf-8;base64,${base64}') ${mimeInfo.format}`;
}

async function convertCSSFontsToBase64(cssText, baseURL) {
    const fontFaceRegex = /@font-face\s*{([^}]+)}/g;

    const processedCSS = await Promise.all(
        Array.from(cssText.matchAll(fontFaceRegex)).map(async (match) => {
            const [fullMatch, content] = match;
            const startIndex = match.index;
            const endIndex = startIndex + fullMatch.length;

            const processedContent = await processFontFace(content, baseURL);
            return `@font-face{${processedContent}}`;
        })
    );

    let lastIndex = 0;
    let result = '';
    const matches = [...cssText.matchAll(fontFaceRegex)];

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        result += cssText.slice(lastIndex, match.index);
        result += processedCSS[i];
        lastIndex = match.index + match[0].length;
    }
    result += cssText.slice(lastIndex);

    return result;
}

async function processFontFace(content, baseURL) {
    const srcRegex = /(src:\s*)([^;]+)(;)/;
    const srcMatch = content.match(srcRegex);
    if (!srcMatch) return content;

    const [fullSrc, prefix, srcValue, suffix] = srcMatch;
    const processedSrc = await processSrcValue(srcValue, baseURL);

    return content.replace(srcRegex, `${prefix}${processedSrc}${suffix}`);
}

async function processSrcValue(srcValue, baseURL) {
    const sources = srcValue.split(/\s*,\s*/);

    const processedSources = await Promise.all(
        sources.map(async (source) => {
            const urlFormatRegex = /url\s*\(\s*['"]?([^'")]*)['"]?\s*\)(\s*format\s*\([^)]*\))?/i;
            const match = source.match(urlFormatRegex);
            if (!match) return source;

            const [fullMatch, url] = match;
            try {
                const absoluteURL = new URL(url, baseURL).href;

                const base64Src = await getFontBase64Src(absoluteURL);
                return source.replace(urlFormatRegex, base64Src);
            } catch (e) {
                console.warn(`Skipped invalid font: ${url}`, e.message);
                return source; // keep original
            }
        })
    );

    return processedSources.join(', ');
}

/* example
convertCSSFontsToBase64(`
@font-face {
    font-family: "TorusSemiBold";
    src: url(../fonts/Torus-SemiBold.otf);
    font-weight: 500;
}
`, 'http://localhost:3000/stylesheets/general.css')
    .then(console.log); */

// save as html
async function saveAsHtml() {
    const container = document.getElementById('nameCardContainer');

    let now = formatNow();

    let css = getScopedCSS(container);

    css = await convertCSSFontsToBase64(css, `${getRootUrl()}/stylesheets/a.css`);

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${user.username}'s osu! name card at ${now}</title>
<style>${css}</style>
</head>
<body>
${container.outerHTML}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    download(url, `osuNameCard-${user.username}-${now}.html`);
    URL.revokeObjectURL(url);
}

function getScopedCSS(targetElement) {
    let scopedCSS = '';
    Array.from(document.styleSheets).forEach(sheet => {
        try {
            Array.from(sheet.cssRules || []).forEach(rule => {
                if (rule instanceof CSSFontFaceRule) {
                    scopedCSS += rule.cssText + '\n';
                }
                else if (rule instanceof CSSStyleRule) {
                    if (isSelectorMatch(rule.selectorText, targetElement)) {
                        scopedCSS += rule.cssText + '\n';
                    }
                }
                else if (rule instanceof CSSMediaRule) {
                    if (window.matchMedia(rule.conditionText).matches) {
                        Array.from(rule.cssRules).forEach(nestedRule => {
                            if (nestedRule instanceof CSSStyleRule &&
                                isSelectorMatch(nestedRule.selectorText, targetElement)) {
                                scopedCSS += `@media ${rule.conditionText} { ${nestedRule.cssText} }\n`;
                            }
                        });
                    }
                }
            });
        } catch (e) {
            // ignore CORS errors
        }
    });
    return scopedCSS;
}

function isSelectorMatch(selector, targetElement) {
    try {
        // target itself
        if (targetElement.matches(selector)) return true;
        // target's ancestors
        if (targetElement.closest(selector)) return true;
        // target's sons
        if (targetElement.querySelector(selector)) return true;
    } catch (_) {
    }
    return false;
}
