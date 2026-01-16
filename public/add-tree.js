// Проверка авторизации
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/check', { credentials: 'include' });
        const data = await res.json();

        if (!data.loggedIn) {
            alert('Нужно войти в аккаунт');
            window.location.href = '/login';
            return false;
        }
        return true;
    } catch (err) {
        console.error('Auth check error:', err);
        return false;
    }
}

// Превью изображения
const imageInput = document.getElementById('image');
if (imageInput) {
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
        };
        reader.readAsDataURL(file);
    });
} else {
    console.error('Input #image не найден');
}

// Добавление факта
const addFactBtn = document.getElementById('addFactBtn');
if (addFactBtn) {
    addFactBtn.addEventListener('click', () => {
        const container = document.getElementById('factsContainer');
        if (!container) return;

        const group = document.createElement('div');
        group.className = 'fact-input-group';
        group.style.marginBottom = '10px';
        group.innerHTML = `
            <input type="text" class="fact-key" placeholder="Название факта" style="width:45%;margin-right:10px;padding:8px;">
            <input type="text" class="fact-value" placeholder="Значение" style="width:45%;padding:8px;">
            <button type="button" class="remove-fact" style="background:#dc3545;color:white;border:none;padding:8px 12px;border-radius:5px;cursor:pointer;">×</button>
        `;
        group.querySelector('.remove-fact').onclick = () => group.remove();
        container.appendChild(group);
    });
}

// Удаление фактов
document.addEventListener('click', e => {
    if (e.target.classList.contains('remove-fact')) {
        e.target.closest('.fact-input-group')?.remove();
    }
});

// Главный обработчик формы
const form = document.getElementById('addTreeForm');

if (!form) {
    console.error('ФОРМА #addTreeForm НЕ НАЙДЕНА — кнопка не будет работать!');
} else {
    ('Форма найдена — привязываем submit');
    form.addEventListener('submit', async e => {
        e.preventDefault();
        ('SUBMIT СРАБОТАЛ! Начинаем отправку');

        if (!(await checkAuth())) {
            ('Авторизация не пройдена — стоп');
            return;
        }

        const msg = document.getElementById('message');
        msg.className = 'auth-message';
        msg.textContent = '';
        msg.style.display = 'none';

        const formData = new FormData(e.target);
        const payload = {
            name: formData.get('name')?.trim(),
            scientificName: formData.get('scientificName')?.trim(),
            description: formData.get('description')?.trim(),
            habitat: formData.get('habitat')?.trim(),
            image: '',
            facts: {}
        };

        if (!payload.name || !payload.scientificName || !payload.description || !payload.habitat) {
            msg.className = 'auth-message error';
            msg.textContent = 'Заполните все обязательные поля';
            msg.style.display = 'block';
            console.warn('Валидация не пройдена — поля пустые');
            return;
        }

        const file = formData.get('image');
        if (!file || file.size === 0) {
            msg.className = 'auth-message error';
            msg.textContent = 'Выберите изображение';
            msg.style.display = 'block';
            console.warn('Изображение не выбрано');
            return;
        }

        try {
            payload.image = await new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.onerror = reject;
                r.readAsDataURL(file);
            });
            ('Изображение в base64 готово (длина:', payload.image.length, ')');
        } catch (err) {
            console.error('Ошибка base64:', err);
            msg.textContent = 'Ошибка обработки изображения';
            msg.style.display = 'block';
            return;
        }

        // Факты
        document.querySelectorAll('.fact-input-group').forEach(g => {
            const k = g.querySelector('.fact-key')?.value.trim();
            const v = g.querySelector('.fact-value')?.value.trim();
            if (k && v) payload.facts[k] = v;
        });

        ('Полный payload:', payload);

        try {
            const res = await fetch('/api/trees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            ('Ответ сервера:', result);

            if (res.ok && result.success) {
                msg.className = 'auth-message success';
                msg.textContent = 'Дерево добавлено!';
                msg.style.display = 'block';
                setTimeout(() => window.location.href = '/', 1500);
            } else {
                throw new Error(result.error || 'Ошибка сервера');
            }
        } catch (err) {
            console.error('Ошибка fetch:', err);
            msg.className = 'auth-message error';
            msg.textContent = err.message || 'Не удалось добавить';
            msg.style.display = 'block';
        }
    });
}

// Запуск проверки при загрузке
checkAuth();