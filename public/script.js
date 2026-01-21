let currentUser = null;
let trees = [];
let currentPage = 1;   // текущая страница
let totalPages = 1;    // общее количество страниц
let searchQuery = '';
let showMyTreesOnly = false;
const TREES_PER_PAGE = 8; // количество деревьев на страницу
window.currentUser = null;

// ─── Инициализация страницы ──────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    loadTrees();
    setupModal();
    setupFilters();
});

// ─── Проверка авторизации ───────────────────────────
async function checkAuthStatus() {
    try {
        const res = await fetch('/api/auth/check', { credentials: 'include' });
        const data = await res.json();

        const authButtons = document.getElementById('authButtons');
        const userInfo = document.getElementById('userInfo');
        const usernameDisplay = document.getElementById('usernameDisplay');
        const avatarImg = document.getElementById('userAvatar');
        const addTreeButtonContainer = document.getElementById('addTreeButtonContainer');

        if (data.loggedIn && data.user) {
            currentUser = data.user;
            authButtons.style.display = 'none';
            userInfo.style.display = 'flex';
            usernameDisplay.textContent = data.user.username;

            if (avatarImg) avatarImg.src = data.user.avatar || '/images/default-avatar.jpg';
            if (addTreeButtonContainer) {
                addTreeButtonContainer.style.display = 'block';
                const addTreeBtn = document.getElementById('addTreeBtn');
                if (addTreeBtn) {
                    const newBtn = addTreeBtn.cloneNode(true);
                    addTreeBtn.parentNode.replaceChild(newBtn, addTreeBtn);
                    newBtn.addEventListener('click', () => window.location.href = '/add-tree');
                }
            }
            setTimeout(initUserDropdown, 100);
        } else {
            currentUser = null;
            authButtons.style.display = 'flex';
            userInfo.style.display = 'none';
            if (addTreeButtonContainer) addTreeButtonContainer.style.display = 'none';
        }
    } catch (err) {
        console.error('Auth check error:', err);
    }
}

// ─── Меню пользователя ─────────────────────────────
function initUserDropdown() {
    const avatarWrapper = document.getElementById('userAvatarWrapper');
    const dropdownMenu = document.getElementById('userDropdownMenu');
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!avatarWrapper || !dropdownMenu) return;

    avatarWrapper.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        dropdownMenu.classList.toggle('active');
    });

    document.addEventListener('click', e => {
        if (!dropdownMenu.contains(e.target) && !avatarWrapper.contains(e.target)) {
            dropdownMenu.classList.remove('active');
        }
    });

    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', () => {
            dropdownMenu.classList.remove('active');
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/jpeg,image/png,image/gif';
            input.onchange = async e => {
                const file = e.target.files[0];
                if (!file) return;
                const formData = new FormData();
                formData.append('avatar', file);
                try {
                    const res = await fetch('/api/user/avatar', { method: 'POST', credentials: 'include', body: formData });
                    const result = await res.json();
                    if (result.success) document.getElementById('userAvatar').src = result.avatar + '?t=' + Date.now();
                    else alert(result.error || 'Ошибка');
                } catch { alert('Ошибка загрузки'); }
            };
            input.click();
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            dropdownMenu.classList.remove('active');
            try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); window.location.reload(); }
            catch (err) { console.error('Ошибка выхода:', err); }
        });
    }
}

// ─── Загрузка деревьев ──────────────────────────────
async function loadTrees(page = 1) {
    try {
        const response = await fetch('/api/trees', { credentials: 'include' });
        const data = await response.json();
        if (!data.success) return;

        trees = data.trees.map(t => ({
            id: t.id,
            name: t.name,
            scientificName: t.scientific_name,
            description: t.description,
            habitat: t.habitat,
            image: t.image,
            facts: t.facts ? (typeof t.facts === 'string' ? JSON.parse(t.facts) : t.facts) : null,
            createdBy: t.created_by,
            creatorName: t.creator_name
        }));

        currentPage = page;
        totalPages = Math.ceil(trees.length / TREES_PER_PAGE);

        renderTreeCards();
        renderPagination();
    } catch (err) { console.error('Load trees error:', err); }
}


// ─── Рендер карточек деревьев ──────────────────────
function renderTreeCards() {
    const container = document.getElementById('treesContainer');
    if (!container) return;

    container.innerHTML = '';

    // Фильтрация
    let filteredTrees = trees;

    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filteredTrees = filteredTrees.filter(tree => tree.name.toLowerCase().includes(query));
    }

    if (showMyTreesOnly && currentUser) {
        filteredTrees = filteredTrees.filter(tree => tree.createdBy === currentUser.id);
    }

    // Пагинация
    totalPages = Math.ceil(filteredTrees.length / 8);
    const start = (currentPage - 1) * 8;
    const end = start + 8;
    const treesToShow = filteredTrees.slice(start, end);

    if (treesToShow.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:white;padding:40px;">Деревья не найдены</p>';
        return;
    }

    treesToShow.forEach(tree => {
        const card = document.createElement('div');
        card.className = 'tree-card';
        card.innerHTML = `
            <img class="tree-card-image" src="${tree.image}" alt="${tree.name}">
            <div class="tree-card-info">
                <h2 class="tree-card-name">${tree.name}</h2>
                <p class="tree-card-scientific">${tree.scientificName}</p>
            </div>
        `;
        card.addEventListener('click', () => openModal(tree));
        container.appendChild(card);
    });

    renderPagination();
}

// ─── Пагинация ─────────────────────────────────────
function renderPagination() {
    const container = document.getElementById('pagination');
    if (!container) return;

    container.innerHTML = '';
    if (totalPages <= 1) return; // если страниц <=1, пагинация не нужна

    const ul = document.createElement('ul');
    ul.className = 'pagination';

    // Кнопка "Назад"
    const prevLi = document.createElement('li');
    prevLi.className = currentPage === 1 ? 'disabled' : '';
    prevLi.innerHTML = `<button>◀</button>`;
    prevLi.onclick = () => { if(currentPage > 1){ currentPage--; renderTreeCards(); renderPagination(); } };
    ul.appendChild(prevLi);

    // Страницы
    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = i === currentPage ? 'active' : '';
        li.innerHTML = `<button>${i}</button>`;
        li.onclick = () => { currentPage = i; renderTreeCards(); renderPagination(); };
        ul.appendChild(li);
    }

    // Кнопка "Вперед"
    const nextLi = document.createElement('li');
    nextLi.className = currentPage === totalPages ? 'disabled' : '';
    nextLi.innerHTML = `<button>▶</button>`;
    nextLi.onclick = () => { if(currentPage < totalPages){ currentPage++; renderTreeCards(); renderPagination(); } };
    ul.appendChild(nextLi);

    container.appendChild(ul);
}

// ─── Инициализация пользователя ───────────────────
async function initUser() {
    try {
        const res = await fetch('/api/auth/check', { credentials: 'include' });
        const data = await res.json();
        window.currentUser = data.loggedIn ? data.user : null;
    } catch (err) {
        console.error('Ошибка проверки авторизации:', err);
        window.currentUser = null;
    }
}

// ─── Настройка фильтров и поиска ──────────────────
function setupFilters() {
    const filterToggleBtn = document.getElementById('filterToggleBtn');
    const filtersPanel = document.getElementById('filtersPanel');
    const myTreesOnlyCheckbox = document.getElementById('myTreesOnly');
    const searchInput = document.getElementById('searchInput');
    const userMenu = document.getElementById('userDropdownMenu');

    const isAuthorized = !!currentUser;

    // Фильтры — только для авторизованных
    if (filterToggleBtn && filtersPanel) {
        filterToggleBtn.style.display = isAuthorized ? 'inline-block' : 'none';
        filtersPanel.style.display = 'none';

        if (isAuthorized) {
            // 🛠 Админка — добавляем только один раз
            if (currentUser.role === 'admin' && userMenu && !document.getElementById('adminPanelBtn')) {
                const adminBtn = document.createElement('button');
                adminBtn.id = 'adminPanelBtn';
                adminBtn.className = 'dropdown-item';
                adminBtn.textContent = '🛠 Админка';
                adminBtn.onclick = () => window.location.href = '/admin';
                userMenu.prepend(adminBtn);
            }

            filterToggleBtn.onclick = () => {
                const isHidden = filtersPanel.style.display === 'none';
                filtersPanel.style.display = isHidden ? 'block' : 'none';
                filterToggleBtn.textContent = isHidden
                    ? 'Закрыть фильтры ⚙️'
                    : '⚙️ Фильтры';
            };

            myTreesOnlyCheckbox?.addEventListener('change', e => {
                showMyTreesOnly = e.target.checked;
                currentPage = 1;
                renderTreeCards();
            });
        }
    }

    // Поиск — для всех пользователей
    searchInput?.addEventListener('input', e => {
        searchQuery = e.target.value.trim();
        currentPage = 1;
        renderTreeCards();
    });
}



// ─── Модальное окно ─────────────────────────────────
function setupModal() {
    const modal = document.getElementById('treeModal');
    const closeBtn = modal.querySelector('.close');
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    window.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

function openModal(tree) {
    const modal = document.getElementById('treeModal');
    const modalBody = document.getElementById('modalBody');

    let factsHTML = '';
    if (tree.facts && typeof tree.facts === 'object' && Object.keys(tree.facts).length) {
        factsHTML = Object.entries(tree.facts).map(([k,v]) => `<div class="fact-item"><strong>${k}:</strong> ${v}</div>`).join('');
    } else factsHTML = '<p style="color:#999;">Факты не указаны</p>';

    const canEditOrDelete = currentUser && (currentUser.id === tree.createdBy || currentUser.role === 'admin');

    let deleteBtnHTML = '';
    let editBtnHTML = '';
    if (canEditOrDelete) {
        deleteBtnHTML = `<button id="deleteTreeBtn" style="background:#dc3545;color:white;padding:12px 24px;border:none;border-radius:8px;cursor:pointer;font-weight:600;margin-top:20px;">🗑️ Удалить дерево</button>`;
        editBtnHTML = `<button id="editTreeBtn" style="background:#28a745;color:white;padding:12px 24px;border:none;border-radius:8px;cursor:pointer;font-weight:600;margin-top:20px;margin-left:12px;">✏️ Редактировать дерево</button>`;
    }

    modalBody.innerHTML = `
        <img src="${tree.image}" alt="${tree.name}" class="modal-image" onerror="this.src='https://via.placeholder.com/800x400/667eea/ffffff?text=${encodeURIComponent(tree.name)}'">
        <h2>${tree.name}</h2>
        <p>${tree.scientificName}</p>
        ${tree.creatorName ? `<p style="color:#666;">Добавлено пользователем: <strong>${tree.creatorName}</strong></p>` : ''}
        <div class="modal-section"><h3>Описание</h3><p>${tree.description}</p></div>
        <div class="modal-section"><h3>Место обитания</h3><p>${tree.habitat}</p></div>
        <div class="modal-section"><h3>Ключевые факты</h3>${factsHTML}</div>
        <div style="margin-top:20px;">${deleteBtnHTML}${editBtnHTML}</div>
    `;

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Delete button (старый код)
    const deleteBtn = document.getElementById('deleteTreeBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (!confirm('Вы уверены?')) return;
            try {
                const res = await fetch(`/api/trees/${tree.id}`, { method: 'DELETE', credentials: 'include' });
                const result = await res.json();
                if (result.success) {
                    alert('Дерево удалено');
                    closeModal();
                    loadTrees();
                } else alert('Ошибка: ' + (result.error || 'Не удалось удалить'));
            } catch {
                alert('Ошибка при удалении');
            }
        });
    }

    // Edit button — новое
    const editBtn = document.getElementById('editTreeBtn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            window.location.href = `/add-tree?id=${tree.id}`;
        });
    }
}

const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') document.body.classList.add('dark-mode');

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeToggle.textContent = isDark ? '☀️' : '🌙';
    });
}


// Запуск после загрузки страницы
document.addEventListener('DOMContentLoaded', async () => {
    await initUser();      // получаем статус авторизации
    setupFilters();        // настраиваем фильтры после проверки
});
document.addEventListener('DOMContentLoaded', setupFilters);

function closeModal() {
    const modal = document.getElementById('treeModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}