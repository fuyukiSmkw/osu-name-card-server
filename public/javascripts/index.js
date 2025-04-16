function getCorsProxyUrl(originalUrl) {
    const currentProtocol = window.location.protocol; // "http:"
    const currentHost = window.location.host; // "example.com:3000"
    return `${currentProtocol}//${currentHost}/proxy/${encodeURIComponent(originalUrl)}`;
}

const saveAsPngBtn = document.getElementById('saveAsPngBtn');
const saveToClipboardBtn = document.getElementById('saveToClipboardBtn');

function enableButtons(yourBool) {
    saveAsPngBtn.disabled = !yourBool;
    saveToClipboardBtn.disabled = !yourBool;
}
enableButtons(false);

var user = {}; // osu-api-v2-js interface User/Extended
var lastUsernameInput = null;

document.getElementById('submitBtn').addEventListener('click', async () => {
    const username = document.getElementById('usernameInput').value.trim();

    if (!username) {
        alert('输入用户名！');
        return;
    }

    // 等待提示
    const waitStatus = document.getElementById('waitStatus');
    waitStatus.innerHTML = '制作中...';

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
                throw new Error(`HTTP Error, status code: ${response.status}`);

            const data = await response.json();
            user = data.user;
        } catch (error) {
            console.error('Error fetching user from server: ', error);
            alert('获取用户信息失败: ', error);
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
    nameCardContainer.style.width = `${width}px`;
    nameCardContainer.style.height = `${height}px`;
    // 设置边框圆角大小
    const brrrr = Math.round(Math.min(width, height) * 0.12);
    const userRadius = document.getElementById('borderRadiusInput').value || NaN;
    if (document.getElementById('roundedCornerCheck').checked)
        if (isNaN(userRadius))
            nameCardContainer.style.borderRadius = `${brrrr}px`;
        else
            nameCardContainer.style.borderRadius = `${userRadius}px`;
    else
        nameCardContainer.style.borderRadius = '0';

    // 背景banner获取
    const userBgURL = document.getElementById('userBgInput').value.trim() || user.cover.url;
    const userBgColor = document.getElementById('userBgColorInput').value.trim();
    const bgOverlay = nameCardContainer.querySelector('.backgroundOverlay');
    if (userBgColor)
        bgOverlay.style.background = userBgColor;
    else
        bgOverlay.style.background = `url(${getCorsProxyUrl(userBgURL)}) center/cover no-repeat`;

    // 设置图片和用户名
    const img = nameCardContainer.querySelector('#avatarImg');
    img.src = getCorsProxyUrl(user.avatar_url);
    img.alt = `${user.username}'s avatar`;
    const text = nameCardContainer.querySelector('#usernameText');
    text.innerHTML = user.username;

    waitStatus.innerHTML = '制作完成！';
    enableButtons(true);
});

// Save as PNG button
saveAsPngBtn.addEventListener('click', async () => {
    const container = document.getElementById('nameCardContainer');

    try {
        const link = document.createElement('a');
        link.download = `osuNameCard-${user.username}-${Date.now()}.png`;
        link.href = await domtoimage.toPng(container);
        link.click();
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

        navigator.clipboard.write(data).then(()=>{}, ()=>{
            throw new Error('error saving to clipboard');
        });
    } catch (error) {
        alert(`保存失败: ${error.message}`);
    }
});
