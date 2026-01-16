let currentUser = null;
let trees = [];

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    loadTrees();
    setupModal();
});

// Check authentication status
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();

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

            const myTreesFilter = document.getElementById('myTreesFilter');
            if (myTreesFilter) {
                myTreesFilter.style.display = 'block';
            }

            if (avatarImg) {
                avatarImg.src = data.user.avatar || '/images/default-avatar.jpg';
            }

            // Показываем контейнер с кнопкой
            if (addTreeButtonContainer) {
                addTreeButtonContainer.style.display = 'block';

                // Находим кнопку и надёжно привязываем обработчик
                const addTreeBtn = document.getElementById('addTreeBtn');
                if (addTreeBtn) {
                    // Удаляем старые обработчики (если были дубли)
                    const newBtn = addTreeBtn.cloneNode(true);
                    addTreeBtn.parentNode.replaceChild(newBtn, addTreeBtn);

                    // Привязываем клик
                    newBtn.addEventListener('click', () => {
                        ('Переход на страницу добавления дерева'); // для отладки
                        window.location.href = '/add-tree';
                    });
                } else {
                    console.warn('Кнопка #addTreeBtn не найдена в DOM');
                }
            } else {
                console.warn('Контейнер #addTreeButtonContainer не найден');
            }

            // Инициализация меню аватара с небольшой задержкой (на случай асинхронного обновления DOM)
            setTimeout(initUserDropdown, 100);
        } else {
            currentUser = null;
            authButtons.style.display = 'flex';
            userInfo.style.display = 'none';

            if (addTreeButtonContainer) {
                addTreeButtonContainer.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }
}

// Функция для инициализации выпадающего меню
function initUserDropdown() {
    const avatarWrapper = document.getElementById('userAvatarWrapper');
    const dropdownMenu = document.getElementById('userDropdownMenu');
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!avatarWrapper || !dropdownMenu) {
        console.error('Элементы меню аватара НЕ НАЙДЕНЫ в DOM');
        return;
    }

    ('Меню успешно инициализировано');

    // Клик по аватару
    avatarWrapper.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropdownMenu.classList.toggle('active');
        ('Клик по аватару → меню:', dropdownMenu.classList.contains('active') ? 'ОТКРЫТО' : 'ЗАКРЫТО');
    });

    // Клик вне меню → закрыть
    document.addEventListener('click', (e) => {
        if (!dropdownMenu.contains(e.target) && !avatarWrapper.contains(e.target)) {
            dropdownMenu.classList.remove('active');
            ('Клик вне меню → меню закрыто');
        }
    });

    // Изменить аватар
    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', () => {
            dropdownMenu.classList.remove('active');
            ('Нажата кнопка "Изменить аватар"');
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/jpeg,image/png,image/gif';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const formData = new FormData();
                formData.append('avatar', file);

                try {
                    const res = await fetch('/api/user/avatar', {
                        method: 'POST',
                        credentials: 'include',
                        body: formData
                    });
                    const result = await res.json();
                    if (result.success) {
                        document.getElementById('userAvatar').src = result.avatar + '?t=' + Date.now();
                        alert('Аватар обновлён');
                    } else {
                        alert(result.error || 'Ошибка');
                    }
                } catch (err) {
                    alert('Ошибка загрузки');
                }
            };
            input.click();
        });
    }

    // Выйти
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            dropdownMenu.classList.remove('active');
            ('Нажата кнопка "Выйти"');
            try {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                window.location.reload();
            } catch (err) {
                console.error('Ошибка выхода:', err);
            }
        });
    }
}

// Load trees from database
async function loadTrees() {
    try {
        const response = await fetch('/api/trees');
        const data = await response.json();

        if (data.success) {
            trees = data.trees.map(tree => ({
                id: tree.id,
                name: tree.name,
                scientificName: tree.scientific_name,
                description: tree.description,
                habitat: tree.habitat,
                image: tree.image,
                facts: tree.facts ? (typeof tree.facts === 'string' ? JSON.parse(tree.facts) : tree.facts) : null,
                createdBy: tree.created_by,
                creatorName: tree.creator_name
            }));

            renderTreeCards();
        } else {
            console.warn('No trees loaded');
        }
    } catch (error) {
        console.error('Load trees error:', error);
    }
}

// Render tree cards
// Глобальные переменные для фильтров
let searchQuery = '';
let showMyTreesOnly = false;

// Load trees from database
async function loadTrees() {
    try {
        const response = await fetch('/api/trees');
        const data = await response.json();

        if (data.success) {
            trees = data.trees.map(tree => ({
                id: tree.id,
                name: tree.name,
                scientificName: tree.scientific_name,
                description: tree.description,
                habitat: tree.habitat,
                image: tree.image,
                facts: tree.facts ? (typeof tree.facts === 'string' ? JSON.parse(tree.facts) : tree.facts) : null,
                createdBy: tree.created_by,
                creatorName: tree.creator_name
            }));

            renderTreeCards(); // Первичный рендер
        } else {
            console.warn('No trees loaded');
        }
    } catch (error) {
        console.error('Load trees error:', error);
    }
}

// Render tree cards with filters
function renderTreeCards() {
    const container = document.getElementById('treesContainer');
    if (!container) return;

    container.innerHTML = '';

    // Фильтрация
    let filteredTrees = trees;

    // Поиск по названию (регистронезависимо)
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filteredTrees = filteredTrees.filter(tree =>
            tree.name.toLowerCase().includes(query)
        );
    }

    // Только мои деревья
    if (showMyTreesOnly && currentUser) {
        filteredTrees = filteredTrees.filter(tree =>
            tree.createdBy === currentUser.id
        );
    }

    if (filteredTrees.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: white; font-size: 1.2rem; padding: 40px;">Деревья не найдены</p>';
        return;
    }

    filteredTrees.forEach(tree => {
        const card = document.createElement('div');
        card.className = 'tree-card';
        card.innerHTML = `
            <img class="tree-card-image" src="${tree.image}" alt="${tree.name}" onerror="this.src='https://via.placeholder.com/300x250/667eea/ffffff?text=${encodeURIComponent(tree.name)}'">
            <div class="tree-card-info">
                <h2 class="tree-card-name">${tree.name}</h2>
                <p class="tree-card-scientific">${tree.scientificName}</p>
            </div>
        `;
        card.addEventListener('click', () => openModal(tree));
        container.appendChild(card);
    });
}

// Обработчики поиска и фильтра
document.addEventListener('DOMContentLoaded', () => {
    // Поиск (live search)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', e => {
            searchQuery = e.target.value;
            renderTreeCards();
        });
    }

    // Чекбокс "Только мои"
    const myTreesCheckbox = document.getElementById('myTreesOnly');
    if (myTreesCheckbox) {
        myTreesCheckbox.addEventListener('change', e => {
            showMyTreesOnly = e.target.checked;
            renderTreeCards();
        });
    }
});

// Setup modal
function setupModal() {
    const modal = document.getElementById('treeModal');
    const closeBtn = modal.querySelector('.close');

    closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

// Open modal with tree details
function openModal(tree) {
    const modal = document.getElementById('treeModal');
    const modalBody = document.getElementById('modalBody');

    let factsHTML = '';
    if (tree.facts && typeof tree.facts === 'object' && Object.keys(tree.facts).length > 0) {
        factsHTML = Object.entries(tree.facts).map(([key, value]) => `
            <div class="fact-item">
                <strong>${key}:</strong> ${value}
            </div>
        `).join('');
    } else {
        factsHTML = '<p style="color: #999;">Факты не указаны</p>';
    }

    let deleteButton = '';
    if (currentUser && (currentUser.id === tree.createdBy || currentUser.role === 'admin')) {
        deleteButton = `
        <button id="deleteTreeBtn" class="btn btn-secondary" style="background: #dc3545; color: white; margin-top: 20px; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
            🗑️ Удалить дерево
        </button>
    `;
    }

    modalBody.innerHTML = `
        <img src="${tree.image}" alt="${tree.name}" class="modal-image" onerror="this.src='https://via.placeholder.com/800x400/667eea/ffffff?text=${encodeURIComponent(tree.name)}'">
        <h2 class="modal-title">${tree.name}</h2>
        <p class="modal-scientific">${tree.scientificName}</p>
        ${tree.creatorName ? `<p style="color: #666; margin-bottom: 20px;">Добавлено пользователем: <strong>${tree.creatorName}</strong></p>` : ''}
        
        <div class="modal-section">
            <h3>Описание</h3>
            <p>${tree.description}</p>
        </div>
        
        <div class="modal-section">
            <h3>Место обитания</h3>
            <p>${tree.habitat}</p>
        </div>
        
        <div class="modal-section">
            <h3>Ключевые факты</h3>
            <div class="modal-facts">
                ${factsHTML}
            </div>
        </div>
        
        ${deleteButton}
    `;

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    const deleteBtn = document.getElementById('deleteTreeBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (confirm('Вы уверены, что хотите удалить это дерево?')) {
                try {
                    const response = await fetch(`/api/trees/${tree.id}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    const result = await response.json();

                    if (result.success) {
                        alert('Дерево удалено');
                        closeModal();
                        loadTrees();
                    } else {
                        alert('Ошибка: ' + (result.error || 'Не удалось удалить дерево'));
                    }
                } catch (error) {
                    console.error('Delete error:', error);
                    alert('Ошибка при удалении дерева');
                }
            }
        });
    }
}

// Close modal
function closeModal() {
    const modal = document.getElementById('treeModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Открытие/закрытие панели фильтров
const filterToggleBtn = document.getElementById('filterToggleBtn');
const filtersPanel = document.getElementById('filtersPanel');
const myTreesOnlyCheckbox = document.getElementById('myTreesOnly');

if (filterToggleBtn && filtersPanel) {
    filterToggleBtn.addEventListener('click', () => {
        const isHidden = filtersPanel.style.display === 'none' || !filtersPanel.style.display;
        filtersPanel.style.display = isHidden ? 'block' : 'none';
        filterToggleBtn.textContent = isHidden ? 'Закрыть фильтры ⚙️' : '⚙️ Фильтры';
    });
}

// Обработчик чекбокса (фильтрация)
if (myTreesOnlyCheckbox) {
    myTreesOnlyCheckbox.addEventListener('change', e => {
        showMyTreesOnly = e.target.checked;
        renderTreeCards();
    });
}