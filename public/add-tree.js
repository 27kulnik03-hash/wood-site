let currentImage = null; // Хранит текущее изображение (base64) при редактировании
let treeId = null;       // ID дерева при редактировании
let isEditMode = false;

document.addEventListener('DOMContentLoaded', async () => {
    // Определяем режим по параметру id в URL
    const urlParams = new URLSearchParams(window.location.search);
    treeId = urlParams.get('id');
    isEditMode = !!treeId;

    if (isEditMode) {
        document.getElementById('pageTitle').textContent = '🌳 Редактировать дерево';
        document.getElementById('pageTitleElement').textContent = 'Редактировать дерево - Tree Encyclopedia';
        document.getElementById('submitBtn').textContent = 'Сохранить изменения';
        document.querySelector('label[for="image"]').textContent = 'Новое изображение (опционально)';
        document.querySelector('small').textContent = 'При редактировании можно оставить текущее изображение.';

        await loadTreeData();
    } else {
        // Для добавления — добавляем один пустой факт по умолчанию
        addFactField();
    }

    setupEventListeners();
    await checkAuth();
});

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/check', { credentials: 'include' });
        const data = await res.json();
        if (!data.loggedIn) {
            alert('Нужно войти в аккаунт');
            window.location.href = '/login';
        }
    } catch (err) {
        console.error('Auth check error:', err);
    }
}

async function loadTreeData() {
    try {
        const res = await fetch(`/api/trees/${treeId}`, { credentials: 'include' });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Не удалось загрузить дерево');

        const tree = data.tree;

        document.getElementById('name').value = tree.name || '';
        document.getElementById('scientificName').value = tree.scientific_name || '';
        document.getElementById('description').value = tree.description || '';
        document.getElementById('habitat').value = tree.habitat || '';

        // Текущее изображение
        if (tree.image) {
            currentImage = tree.image;
            const preview = document.getElementById('previewImg');
            preview.src = tree.image;
            document.getElementById('imagePreview').style.display = 'block';
        }

        // Факты
        const facts = tree.facts ? (typeof tree.facts === 'string' ? JSON.parse(tree.facts) : tree.facts) : {};
        const container = document.getElementById('factsContainer');
        container.innerHTML = ''; // очищаем

        if (Object.keys(facts).length === 0) {
            addFactField(); // пустой для нового
        } else {
            Object.entries(facts).forEach(([key, value]) => {
                addFactField(key, value);
            });
        }
    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        alert('Не удалось загрузить данные дерева');
        window.location.href = '/';
    }
}

function addFactField(key = '', value = '') {
    const container = document.getElementById('factsContainer');
    const group = document.createElement('div');
    group.className = 'fact-input-group';
    group.style.marginBottom = '10px';
    group.innerHTML = `
        <input type="text" class="fact-key" placeholder="Название факта" value="${key}" style="width:45%;margin-right:10px;padding:8px;">
        <input type="text" class="fact-value" placeholder="Значение" value="${value}" style="width:45%;padding:8px;">
        <button type="button" class="remove-fact" style="background:#dc3545;color:white;border:none;padding:8px 12px;border-radius:5px;cursor:pointer;">×</button>
    `;
    group.querySelector('.remove-fact').onclick = () => group.remove();
    container.appendChild(group);
}

function setupEventListeners() {
    // Превью нового изображения
    const imageInput = document.getElementById('image');
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('Изображение слишком большое (макс 5 МБ)');
            this.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = ev => {
            document.getElementById('previewImg').src = ev.target.result;
            document.getElementById('imagePreview').style.display = 'block';
            currentImage = ev.target.result; // обновляем текущее для отправки
        };
        reader.readAsDataURL(file);
    });

    // Добавление факта
    document.getElementById('addFactBtn').addEventListener('click', () => addFactField());

    // Форма
    document.getElementById('addTreeForm').addEventListener('submit', async e => {
        e.preventDefault();

        const msg = document.getElementById('message');
        msg.className = 'auth-message';
        msg.textContent = '';
        msg.style.display = 'none';

        const payload = {
            name: document.getElementById('name').value.trim(),
            scientificName: document.getElementById('scientificName').value.trim(),
            description: document.getElementById('description').value.trim(),
            habitat: document.getElementById('habitat').value.trim(),
            image: currentImage || '', // если нет изображения вообще — ошибка ниже
            facts: {}
        };

        // Валидация обязательных полей
        if (!payload.name || !payload.scientificName || !payload.description || !payload.habitat) {
            msg.className = 'auth-message error';
            msg.textContent = 'Заполните все обязательные поля';
            msg.style.display = 'block';
            return;
        }

        if (!payload.image) {
            msg.className = 'auth-message error';
            msg.textContent = 'Изображение обязательно';
            msg.style.display = 'block';
            return;
        }

        // Сбор фактов
        document.querySelectorAll('.fact-input-group').forEach(g => {
            const k = g.querySelector('.fact-key')?.value.trim();
            const v = g.querySelector('.fact-value')?.value.trim();
            if (k && v) payload.facts[k] = v;
        });

        const url = isEditMode ? `/api/trees/${treeId}` : '/api/trees';
        const method = isEditMode ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            if (res.ok && result.success) {
                msg.className = 'auth-message success';
                msg.textContent = isEditMode ? 'Изменения сохранены!' : 'Дерево добавлено!';
                msg.style.display = 'block';
                setTimeout(() => window.location.href = '/', 1500);
            } else {
                throw new Error(result.error || 'Ошибка сервера');
            }
        } catch (err) {
            console.error('Ошибка отправки:', err);
            msg.className = 'auth-message error';
            msg.textContent = err.message || 'Не удалось сохранить';
            msg.style.display = 'block';
        }
    });
}