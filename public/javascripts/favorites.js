// 修改事件绑定方式 - 使用事件委托
document.addEventListener('click', async function(event) {
    // 检查点击的目标是否是收藏按钮或其子元素
    const button = event.target.closest('.favorite-btn');
    if (!button) return;

    const contentType = button.dataset.contentType;
    const contentId = button.dataset.contentId;
    const roomId = button.dataset.roomId;
    const icon = button.querySelector('i');
    
    try {
        const response = await fetch('/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contentType, 
                contentId: contentId || null,
                roomId: roomId || null
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 切换心形图标状态
            if (result.action === 'added') {
        icon.classList.replace('bi-heart', 'bi-heart-fill');
        showToast('Added to favorites!');
    } else if (result.action === 'removed') {
        icon.classList.replace('bi-heart-fill', 'bi-heart');
        showToast('Removed from favorites!');
    }
} else {
    showToast(result.message || 'Action failed', 'error');
}
    } catch (error) {
        console.error('Error:', error);
        showToast('Server error', 'error');
    }
});

function showToast(message, type = 'success') {
    // 实现一个简单的toast通知
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}