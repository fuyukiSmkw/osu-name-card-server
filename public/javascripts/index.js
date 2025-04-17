function getRootUrl() {
    return `${window.location.protocol}//${window.location.host}`; // "https://osu-name-card-server.vercel.app/"
}

function getCorsProxyUrl(originalUrl) {
    return `${getRootUrl()}/proxy/${encodeURIComponent(originalUrl)}`;
}

const saveAsPngBtn = document.getElementById('saveAsPngBtn');
const saveToClipboardBtn = document.getElementById('saveToClipboardBtn');
const saveAsHtmlBtn = document.getElementById('saveAsHtmlBtn');

function enableButtons(yourBool) {
    saveAsPngBtn.disabled = !yourBool;
    saveToClipboardBtn.disabled = !yourBool;
    saveAsHtmlBtn.disabled = !yourBool;
}
enableButtons(false);

var user = {}; // osu-api-v2-js interface User/Extended
var lastUsernameInput = null;

// Preload images and show them all at once
var promises = [];
const preloadImage = (imgUrl, callback = (_blobUrl) => { }) => new Promise((resolve, reject) => {
    fetch(imgUrl).then(response => {
        if (!response.ok)
            throw response;
        return response.blob();
    }).then(blob => {
        const reader = new FileReader();
        reader.onload = () => resolve(() => callback(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    }).catch(e => reject(e));
    /*const tmpimg = new Image();
    tmpimg.onload = () => resolve(() => callback(tmpimg));
    tmpimg.onerror = () => reject(new Error(`Error loading image ${imgUrl}`));
    tmpimg.src = imgUrl;*/
});
const addPreloadImage = (imgUrl, callback) => promises.push(preloadImage(imgUrl, callback));
const addWaitForPreloadImages = (callback) => promises.push(new Promise((resolve, _) => resolve(callback)));
async function waitAndShowPreloadImages() {
    try {
        try {
            const callbacks = await Promise.all(promises);
            callbacks.forEach((callback) => {
                callback();
            });
        } catch (error) {
            console.error('Error showing preload images: ', error);
            throw error;
        }
    } finally {
        promises = [];
    }
}

// 等待提示
const waitStatus = document.getElementById('waitStatus');
const setWaitStatus = (str) => { waitStatus.innerHTML = str; }

// document.getElementById('submitBtn').addEventListener('click', async () => { // old
document.getElementById('myForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // 阻止默认提交行为

    const username = document.getElementById('usernameInput').value.trim();

    if (!username) {
        alert('输入用户名！');
        return;
    }

    setWaitStatus('制作中...');

    const failed = () => {
        setWaitStatus('制作失败 qwq');
        enableButtons(false);
    };

    // 访问服务器
    if (username != lastUsernameInput) { // lazy
        lastUsernameInput = username;
        try {
            const response = await fetch('/api/getUserFromUsername', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username
                })
            });

            if (!response.ok)
                throw response;

            const data = await response.json();
            user = data.user;
        } catch (error) {
            console.error('Error fetching user from server: ', error);
            const data = await error?.json();
            console.error(data);
            if ('error' in data) {
                const promptStr = '获取用户信息失败: ' + data?.error?.message;
                alert(promptStr);
            } else {
                alert('获取用户信息失败，请刷新页面重试');
            }
            failed();
            return;
        }
    }

    const nameCardContainer = document.getElementById('nameCardContainer');

    // 尺寸获取
    const width = document.getElementById('widthInput').value || '800';
    const height = document.getElementById('heightInput').value || '450';
    if (isNaN(width) || isNaN(height)) {
        alert('Width or height not a number!');
        return;
    }
    addWaitForPreloadImages(() => {
        nameCardContainer.style.width = `${width}px`;
        nameCardContainer.style.height = `${height}px`;
    });
    // 设置边框圆角大小
    const brrrr = Math.round(Math.min(width, height) * 0.12);
    const userRadius = document.getElementById('borderRadiusInput').value || NaN;
    let finalRadius;
    if (document.getElementById('roundedCornerCheck').checked)
        if (isNaN(userRadius))
            finalRadius = `${brrrr}px`;
        else
            finalRadius = `${userRadius}px`;
    else
        finalRadius = '0';
    addWaitForPreloadImages(() => nameCardContainer.style.borderRadius = finalRadius);

    // 背景 banner URL 及预加载
    const userBgURL = document.getElementById('userBgInput').value.trim() || user.cover.url;
    const userBgColor = document.getElementById('userBgColorInput').value.trim();
    const bgOverlay = nameCardContainer.querySelector('.backgroundOverlay');
    if (userBgColor)
        addWaitForPreloadImages(() => bgOverlay.style.background = userBgColor);
    else
        addPreloadImage(getCorsProxyUrl(userBgURL), (blobUrl) => bgOverlay.style.background = `url(${blobUrl}) center/cover no-repeat`);

    // 设置头像和用户名
    const img = nameCardContainer.querySelector('#avatarImg');
    addPreloadImage(getCorsProxyUrl(user.avatar_url), (blobUrl) => img.src = blobUrl);
    const text = nameCardContainer.querySelector('#usernameText');
    addWaitForPreloadImages(() => {
        img.alt = `${user.username}'s avatar`;
        text.innerHTML = user.username
    });

    try {
        await waitAndShowPreloadImages();
    } catch (error) {
        console.error('Error loading images: ', error);
        const promptStr = '图片加载失败: ' + error?.message;
        alert(promptStr);
        failed();
    }
    waitStatus.innerHTML = '制作完成！';
    enableButtons(true);
});

// 'Save as'-s
function formatLocalISO(timestamp) {
    const date = new Date(timestamp);

    const pad2 = n => String(n).padStart(2, '0');
    const pad3 = n => String(n).padStart(3, '0');

    const YYYY = date.getFullYear();
    const MM = pad2(date.getMonth() + 1);
    const DD = pad2(date.getDate());
    const hh = pad2(date.getHours());
    const mm = pad2(date.getMinutes());
    const ss = pad2(date.getSeconds());
    const ms = pad3(date.getMilliseconds());

    const offsetMin = -date.getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const offH = pad2(Math.floor(Math.abs(offsetMin) / 60));
    const offM = pad2(Math.abs(offsetMin) % 60);

    const tz = offM === '00'
        ? `UTC${sign}${offH}`
        : `UTC${sign}${offH}:${offM}`;

    return `${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}.${ms}-${tz}`;
}
const formatNow = () => formatLocalISO(Date.now());

function download(url, name) {
    const link = document.createElement('a');
    link.download = name;
    link.href = url;
    link.click();
}

// Save as PNG button
saveAsPngBtn.addEventListener('click', async () => {
    const container = document.getElementById('nameCardContainer');

    try {
        download(await domtoimage.toPng(container), `osuNameCard-${user.username}-${formatNow()}.png`);
    } catch (error) {
        alert(`保存失败: ${error.message}`);
    }
});

// Copy to clipboard button
saveToClipboardBtn.addEventListener('click', async () => {
    const container = document.getElementById('nameCardContainer');

    try {
        const blob = await domtoimage.toBlob(container);

        // 使用剪切板API进行复制
        const data = [new ClipboardItem({
            [blob.type]: blob
        })];

        navigator.clipboard.write(data).then(() => { }, () => {
            throw new Error('error saving to clipboard');
        });
    } catch (error) {
        alert(`复制至剪贴板失败: ${error.message}`);
    }
});

// Save as HTML

async function dynamicLoadScript(src) {
    return new Promise((resolve, reject) => {
        const existingScript = document.querySelector(`script[src="${src}"]`);
        if (existingScript) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = (error) => reject(error);
        document.body.appendChild(script);
    });
}

saveAsHtmlBtn.addEventListener('click', async () => {
    try {
        await dynamicLoadScript('/javascripts/save-as-html.js');
    } catch (error) {
        console.error('Error loading save-as-html.js: ', error);
        alert('保存失败！请刷新页面重试');
        return;
    }

    try {
        await saveAsHtml();
    } catch (error) {
        console.error('Error saving as html: ', error);
        alert('保存失败！请刷新页面重试');
    }
});