// ==============================================
//  AUTH & API HELPERS
// ==============================================

const apiFetch = async (url, options = {}) => {
    const token = localStorage.getItem('authToken');
    const headers = { ...(options.headers || {}) };
    if (token) {
        headers['X-Auth-Token'] = token;
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        logout();
        throw new Error('Session expired. Please log in again.');
    }
    return res;
};

const apiPost = async (url, body) => {
    return apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
};

const apiPut = async (url, body) => {
    return apiFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
};

const apiDelete = async (url) => {
    return apiFetch(url, { method: 'DELETE' });
};

// ==============================================
//  CALORIE DENSITY COLOR CODING
// ==============================================

// Normalizes to cal/oz equivalent and returns a background + text color pair
const getCalorieDensityColors = (caloriesPerServing, ouncesPerServing, unitType) => {
    const perUnit = caloriesPerServing / (ouncesPerServing || 1);
    let calPerOz = perUnit;
    if (unitType === 'gram') {
        calPerOz = perUnit * 28.35;
    }
    // Tiers based on cal/oz equivalent
    if (calPerOz <= 15) return { bg: '#dcfce7', text: '#166534' }; // green  — raw veggies, leafy greens
    if (calPerOz <= 35) return { bg: '#ecfccb', text: '#3f6212' }; // lime   — lean proteins, light fruits
    if (calPerOz <= 60) return { bg: '#fef9c3', text: '#854d0e' }; // yellow — most meats, cooked grains
    if (calPerOz <= 100) return { bg: '#ffedd5', text: '#9a3412' }; // orange — fatty meats, bread, honey
    if (calPerOz <= 175) return { bg: '#fee2e2', text: '#991b1b' }; // red    — nuts, peanut butter, mayo
    return { bg: '#fecdd3', text: '#881337' }; // rose   — oils
};

// ==============================================
//  AUTH FLOW
// ==============================================

function showAuthScreen() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('appScreen').classList.add('hidden');
}

function showAppScreen(username) {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    document.getElementById('currentUser').textContent = username;
    document.getElementById('accountUsername').textContent = username;
    initApp();
}

function logout() {
    const token = localStorage.getItem('authToken');
    if (token) {
        fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'X-Auth-Token': token }
        }).catch(() => { });
    }
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUsername');
    showAuthScreen();
}

async function checkAuth() {
    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('currentUsername');
    if (!token || !username) {
        showAuthScreen();
        return;
    }
    try {
        const res = await fetch('/api/auth/me', {
            headers: { 'X-Auth-Token': token }
        });
        if (res.ok) {
            const data = await res.json();
            showAppScreen(data.username);
        } else {
            showAuthScreen();
        }
    } catch {
        showAuthScreen();
    }
}

// Login form
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const authMsg = document.getElementById('authMsg');
    authMsg.innerHTML = '';

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: form.username.value,
                password: form.password.value
            })
        });
        const data = await res.json();

        if (data.status === 'success') {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('currentUsername', data.username);
            form.reset();
            showAppScreen(data.username);
        } else {
            authMsg.innerHTML = `<div class="msg-error text-sm">${data.message}</div>`;
        }
    } catch (err) {
        authMsg.innerHTML = `<div class="msg-error text-sm">Connection error: ${err.message}</div>`;
    }
});

// Signup form
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const authMsg = document.getElementById('authMsg');
    authMsg.innerHTML = '';

    if (form.password.value !== form.confirmPassword.value) {
        authMsg.innerHTML = '<div class="msg-error text-sm">Passwords do not match</div>';
        return;
    }

    try {
        const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: form.username.value,
                password: form.password.value
            })
        });
        const data = await res.json();

        if (data.status === 'success') {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('currentUsername', data.username);
            form.reset();
            showAppScreen(data.username);
        } else {
            authMsg.innerHTML = `<div class="msg-error text-sm">${data.message}</div>`;
        }
    } catch (err) {
        authMsg.innerHTML = `<div class="msg-error text-sm">Connection error: ${err.message}</div>`;
    }
});

// Logout button
document.getElementById('logoutBtn').addEventListener('click', logout);

// Change password form
document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const msgEl = document.getElementById('changePasswordMsg');
    msgEl.innerHTML = '';

    if (form.newPassword.value !== form.confirmNewPassword.value) {
        msgEl.innerHTML = '<div class="msg-error text-sm">New passwords do not match</div>';
        return;
    }

    try {
        const res = await apiPost('/api/auth/change-password', {
            currentPassword: form.currentPassword.value,
            newPassword: form.newPassword.value
        });
        const data = await res.json();

        if (data.status === 'success') {
            form.reset();
            msgEl.innerHTML = '<div class="msg-success text-sm">Password changed successfully!</div>';
        } else {
            msgEl.innerHTML = `<div class="msg-error text-sm">${data.message}</div>`;
        }
    } catch (err) {
        msgEl.innerHTML = `<div class="msg-error text-sm">Error: ${err.message}</div>`;
    }
});

// Account: Import JSON (temporary) and Download data
document.getElementById('accountImportBtn').addEventListener('click', () => {
    document.getElementById('accountImportFile').click();
});

document.getElementById('accountImportFile').addEventListener('change', async (e) => {
    const file = e.target && e.target.files && e.target.files[0];
    const msgEl = document.getElementById('accountDataMsg');
    msgEl.innerHTML = '';
    if (!file) return;
    try {
        const formData = new FormData();
        formData.append('file', file);
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/account/import', {
            method: 'POST',
            headers: token ? { 'X-Auth-Token': token } : {},
            body: formData
        });
        const data = await res.json();
        if (data.status === 'success') {
            msgEl.innerHTML = '<div class="msg-success text-sm">' + (data.message || 'Data imported temporarily.') + '</div>';
        } else {
            msgEl.innerHTML = '<div class="msg-error text-sm">' + (data.message || 'Import failed.') + '</div>';
        }
    } catch (err) {
        msgEl.innerHTML = '<div class="msg-error text-sm">Import error: ' + (err.message || 'connection failed') + '</div>';
    }
    e.target.value = '';
});

document.getElementById('accountDownloadBtn').addEventListener('click', async () => {
    const msgEl = document.getElementById('accountDataMsg');
    msgEl.innerHTML = '';
    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/account/export', {
            headers: token ? { 'X-Auth-Token': token } : {}
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            msgEl.innerHTML = '<div class="msg-error text-sm">' + (data.message || 'Download failed') + '</div>';
            return;
        }
        const blob = await res.blob();
        const filename = res.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] || 'diet_data.json';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        msgEl.innerHTML = '<div class="msg-success text-sm">Download started.</div>';
    } catch (err) {
        msgEl.innerHTML = '<div class="msg-error text-sm">Download error: ' + (err.message || 'connection failed') + '</div>';
    }
});

// ==============================================
//  TAB SWITCHING
// ==============================================

let chartsRendered = false;

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    const tabEl = document.getElementById(`tab-${tabName}`);
    if (tabEl) {
        tabEl.classList.remove('hidden');
    }

    const btnEl = document.querySelector(`[data-tab="${tabName}"]`);
    if (btnEl) {
        btnEl.classList.add('active');
    }

    // Re-render charts when charts tab is shown (they need visible container)
    if (tabName === 'charts' && !chartsRendered) {
        chartsRendered = true;
        loadRecentWeights();
        loadWeightChart();
        loadBloodPressureChart();
        loadCaloriesChart();
    }

    // Lazy-load recipes tab data
    if (tabName === 'recipes' && !recipesLoaded) {
        recipesLoaded = true;
        updateRecipeTemplateSelect();
        loadSavedRecipes();
    }

    // Lazy-load AI Advisor prompts
    if (tabName === 'ai-advisor' && !aiAdvisorLoaded) {
        aiAdvisorLoaded = true;
        loadAiAdvisorPrompts();
    }

    // Sync and show food log calendar when Today tab is visible
    if (tabName === 'today') {
        calendarYear = currentViewDate.getFullYear();
        renderFoodLogCalendar();
    }
}

let aiAdvisorLoaded = false;

async function loadAiAdvisorPrompts() {
    const weightEl = document.getElementById('aiAdvisorWeightPrompt');
    const foodsEl = document.getElementById('aiAdvisorFoodsPrompt');
    const recipesEl = document.getElementById('aiAdvisorRecipesPrompt');
    if (!weightEl || !foodsEl || !recipesEl) return;

    const parseJson = async (res) => {
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch {
            return { status: 'error', message: text || res.statusText };
        }
    };

    const fetchWeight = () => apiFetch('/api/weight_log_all').then(parseJson);
    const fetchFoods = () => apiFetch('/api/top_foods?limit=50').then(parseJson);

    try {
        const [weightSettled, foodsSettled] = await Promise.allSettled([fetchWeight(), fetchFoods()]);
        const weightRes = weightSettled.status === 'fulfilled' ? weightSettled.value : { status: 'error' };
        const foodsRes = foodsSettled.status === 'fulfilled' ? foodsSettled.value : { status: 'error' };

        const weights = weightRes.status === 'success' && Array.isArray(weightRes.weights) ? weightRes.weights : [];
        const foods = foodsRes.status === 'success' && Array.isArray(foodsRes.foods) ? foodsRes.foods : [];

        const weightBlock = weights.length > 0
            ? weights.map(w => `${w.date}\t${w.weight} lbs`).join('\n')
            : '(No weight entries logged yet.)';

        const disclaimer = 'Important: Your response is for informational purposes only and is not medical advice. I will consult a healthcare provider for medical advice.';
        weightEl.value = `${disclaimer}

Below is my weight log (date and weight in lbs). Please look at it and identify any trends or patterns. I understand that day-to-day weight fluctuations and occasional plateaus are normal—just share what you notice about my data.

${weightBlock}`;

        const foodsBlock = foods.length > 0
            ? foods.map(f => `${f.name}: logged ${f.count} time(s)`).join('\n')
            : '(No food entries logged yet.)';

        foodsEl.value = `${disclaimer}

Below is how often I've logged each of my top foods (count = number of times logged). Please give me healthy eating advice based on this—what stands out, what I might eat more or less of, and any gentle suggestions.

${foodsBlock}`;

        const recipeFoodList = foods.length > 0
            ? foods.slice(0, 30).map(f => f.name).join(', ')
            : '(No food entries yet—log some meals first.)';
        const dailyCalorieBudget = getCalorieGoal();

        recipesEl.value = `${disclaimer}

These are foods I eat often: ${recipeFoodList}

My daily calorie budget: ${dailyCalorieBudget} kcal.

Please suggest a few simple recipes I might enjoy that use these ingredients or similar flavors. Requirements:
- Do not include breakfast foods in your suggestions (lunch/dinner/snacks only).
- Keep recipes simple.
- Do not invent recipes—only suggest recipes from reputable sources (e.g. well-known cookbooks, established recipe sites like BBC Good Food, Serious Eats, etc.) and cite or link to the source when possible.
- Include brief instructions and approximate servings and calories per serving if you can.`;
    } catch (err) {
        console.error('AI Advisor load error:', err);
        weightEl.value = 'Could not load data. Please refresh and try again.';
        foodsEl.value = 'Could not load data. Please refresh and try again.';
        recipesEl.value = 'Could not load data. Please refresh and try again.';
    }
}

function showCopyFeedback(btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
}

function setupAiAdvisorCopyButtons() {
    const copy = (textareaId, btnId) => {
        const el = document.getElementById(textareaId);
        if (el && el.value) {
            navigator.clipboard.writeText(el.value).then(() => showCopyFeedback(btnId)).catch(() => { });
        }
    };
    document.getElementById('copyWeightPrompt')?.addEventListener('click', () => copy('aiAdvisorWeightPrompt', 'copyWeightPrompt'));
    document.getElementById('copyFoodsPrompt')?.addEventListener('click', () => copy('aiAdvisorFoodsPrompt', 'copyFoodsPrompt'));
    document.getElementById('copyRecipesPrompt')?.addEventListener('click', () => copy('aiAdvisorRecipesPrompt', 'copyRecipesPrompt'));
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ==============================================
//  DATE HELPERS
// ==============================================

function getTodayLocalDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getLocalDateFromUTC(timestamp) {
    const date = new Date(timestamp);
    return getLocalDate(date);
}

function getExpandedDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() + 1);
    return { start: getLocalDate(start), end: getLocalDate(end) };
}

function formatDisplayDate(date) {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    if (getLocalDate(date) === getLocalDate(today)) return 'Today';
    if (getLocalDate(date) === getLocalDate(yesterday)) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function setTodayForLogDate() {
    const today = getTodayLocalDate();
    const logDateInput = document.getElementById('logDate');
    const quickAddDateInput = document.getElementById('quickAddDate');
    const logRecipeDateInput = document.getElementById('logRecipeDate');
    if (logDateInput) logDateInput.value = today;
    if (quickAddDateInput) quickAddDateInput.value = today;
    if (logRecipeDateInput) logRecipeDateInput.value = today;
}

/** Sync log form date inputs to the currently viewed day so Quick Add / Log Food / Log Recipe go to the day shown in the food log. */
function syncLogFormDatesToView() {
    const viewDate = getLocalDate(currentViewDate);
    const logDateInput = document.getElementById('logDate');
    const quickAddDateInput = document.getElementById('quickAddDate');
    const logRecipeDateInput = document.getElementById('logRecipeDate');
    if (logDateInput) logDateInput.value = viewDate;
    if (quickAddDateInput) quickAddDateInput.value = viewDate;
    if (logRecipeDateInput) logRecipeDateInput.value = viewDate;
}

// ==============================================
//  UNIT UI HELPERS
// ==============================================

function extractMealMetaFromOptionText(txt) {
    const unitMatch = txt.match(/cal\/(\d+(?:\.\d+)?)\s+([a-zA-Z]+)/);
    const calMatch = txt.match(/\((\d+(?:\.\d+)?)\s*cal/);
    return {
        caloriesPerServing: calMatch ? parseFloat(calMatch[1]) : null,
        unitsPerServing: unitMatch ? parseFloat(unitMatch[1]) : null,
        unitType: unitMatch ? unitMatch[2] : null,
    };
}

function mealToOptionText(meal) {
    const unitType = meal.unit_type || 'piece';
    return `${meal.name} (${meal.calories_per_serving} cal/${meal.ounces_per_serving} ${unitType})`;
}

function updateUnitUI() {
    const mealIdHidden = document.getElementById('mealIdHidden');
    const unitLabel = document.getElementById('selectedUnitLabel');
    const unitHint = document.getElementById('selectedUnitHint');
    const id = mealIdHidden && mealIdHidden.value ? parseInt(mealIdHidden.value, 10) : null;
    const meal = id ? allMealsForSelect.find(m => m.id === id) : null;
    const optionText = meal ? mealToOptionText(meal) : '';
    if (!optionText) {
        if (unitLabel) unitLabel.textContent = '';
        if (unitHint) unitHint.textContent = '';
        return;
    }
    const meta = extractMealMetaFromOptionText(optionText);
    if (unitLabel) unitLabel.textContent = meta.unitType ? `(${meta.unitType})` : '';
    if (unitHint) unitHint.textContent =
        meta.caloriesPerServing && meta.unitsPerServing && meta.unitType
            ? `${meta.caloriesPerServing} cal per ${meta.unitsPerServing} ${meta.unitType}`
            : '';
    updateLiveCalc();
}

function updateLiveCalc() {
    const mealIdHidden = document.getElementById('mealIdHidden');
    const ouncesInput = document.querySelector('#logMealForm input[name="ounces"]');
    const liveCalc = document.getElementById('liveCalc');
    const id = mealIdHidden && mealIdHidden.value ? parseInt(mealIdHidden.value, 10) : null;
    const meal = id ? allMealsForSelect.find(m => m.id === id) : null;
    const optionText = meal ? mealToOptionText(meal) : '';
    const qty = parseFloat(ouncesInput && ouncesInput.value || '0');
    if (!optionText || !(qty > 0)) {
        if (liveCalc) liveCalc.textContent = '';
        return;
    }
    const meta = extractMealMetaFromOptionText(optionText);
    if (meta.caloriesPerServing != null && meta.unitsPerServing != null && meta.unitsPerServing > 0) {
        const total = Math.round((qty * meta.caloriesPerServing) / meta.unitsPerServing);
        const unit = meta.unitType || 'units';
        if (liveCalc) liveCalc.textContent = `${qty} ${unit} = ${total} cal`;
    } else {
        if (liveCalc) liveCalc.textContent = '';
    }
}

// ==============================================
//  MEAL SELECT / TEMPLATES
// ==============================================

let allMealsForSelect = [];

function sortMealsByCategoryThenName(meals) {
    return [...meals].sort((a, b) => {
        const catA = (a.category || 'Other').toLowerCase();
        const catB = (b.category || 'Other').toLowerCase();
        if (catA !== catB) return catA.localeCompare(catB);
        return (a.name || '').localeCompare(b.name || '');
    });
}

function renderMealComboboxDropdown(meals) {
    const dropdown = document.getElementById('mealTemplateDropdown');
    if (!dropdown) return;

    if (!meals || meals.length === 0) {
        dropdown.innerHTML = '<div class="px-3 py-2 text-sm text-gray-500">No matching templates</div>';
        dropdown.classList.remove('hidden');
        return;
    }

    const byCategory = {};
    meals.forEach(meal => {
        const cat = meal.category || 'Other';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(meal);
    });

    const categories = Object.keys(byCategory).sort((a, b) => a.localeCompare(b));
    let html = '';
    categories.forEach(cat => {
        html += `<div class="px-2 pt-2 pb-0.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">${cat}</div>`;
        byCategory[cat].forEach(meal => {
            const unitType = meal.unit_type || 'piece';
            const displayText = mealToOptionText(meal);
            const colors = getCalorieDensityColors(meal.calories_per_serving, meal.ounces_per_serving, unitType);
            const escaped = displayText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            html += `<div class="meal-combobox-option px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-0" role="option" tabindex="-1" data-meal-id="${meal.id}" style="background-color:${colors.bg};color:${colors.text}">${escaped}</div>`;
        });
    });
    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
}

function filterMealsBySearch(meals, query, selectedId) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return meals;
    const filtered = meals.filter(m => (m.name || '').toLowerCase().includes(q));
    if (selectedId && !filtered.some(m => m.id === selectedId)) {
        const selected = meals.find(m => m.id === selectedId);
        if (selected) filtered.unshift(selected);
    }
    return filtered;
}

async function updateMealSelect() {
    try {
        const res = await apiFetch('/api/meals');
        const data = await res.json();
        const meals = data.meals || [];
        allMealsForSelect = sortMealsByCategoryThenName(meals);
        updateUnitUI();
    } catch (err) {
        console.error('Error loading meal templates:', err);
    }
}

function hideMealComboboxDropdown() {
    const dropdown = document.getElementById('mealTemplateDropdown');
    const combobox = document.getElementById('mealTemplateCombobox');
    if (dropdown) dropdown.classList.add('hidden');
    if (combobox) combobox.setAttribute('aria-expanded', 'false');
}

function setupMealCombobox() {
    const combobox = document.getElementById('mealTemplateCombobox');
    const hidden = document.getElementById('mealIdHidden');
    const dropdown = document.getElementById('mealTemplateDropdown');
    if (!combobox || !hidden || !dropdown) return;

    function showFiltered(query) {
        const filtered = filterMealsBySearch(allMealsForSelect, query, null);
        renderMealComboboxDropdown(filtered);
        combobox.setAttribute('aria-expanded', 'true');
    }

    combobox.addEventListener('input', () => {
        const query = combobox.value.trim();
        hidden.value = '';
        updateUnitUI();
        showFiltered(query);
    });

    combobox.addEventListener('focus', () => {
        showFiltered(combobox.value.trim());
    });

    combobox.addEventListener('blur', () => {
        setTimeout(hideMealComboboxDropdown, 150);
    });

    combobox.addEventListener('keydown', (e) => {
        const options = dropdown.querySelectorAll('.meal-combobox-option');
        if (!options.length) return;
        const focused = dropdown.querySelector('.meal-combobox-option[data-focus="true"]');
        let idx = focused ? Array.from(options).indexOf(focused) : -1;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            idx = idx < options.length - 1 ? idx + 1 : 0;
            options.forEach((el, i) => {
                el.setAttribute('data-focus', i === idx ? 'true' : 'false');
                el.classList.toggle('bg-indigo-100', i === idx);
            });
            options[idx].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            idx = idx <= 0 ? options.length - 1 : idx - 1;
            options.forEach((el, i) => {
                el.setAttribute('data-focus', i === idx ? 'true' : 'false');
                el.classList.toggle('bg-indigo-100', i === idx);
            });
            options[idx].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter' && idx >= 0 && options[idx]) {
            e.preventDefault();
            options[idx].click();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            hideMealComboboxDropdown();
            combobox.blur();
        }
    });

    dropdown.addEventListener('mousedown', (e) => {
        const option = e.target.closest('.meal-combobox-option');
        if (!option) return;
        e.preventDefault();
        const id = option.getAttribute('data-meal-id');
        const meal = allMealsForSelect.find(m => m.id === parseInt(id, 10));
        if (meal) {
            hidden.value = meal.id;
            combobox.value = mealToOptionText(meal);
            updateUnitUI();
        }
        hideMealComboboxDropdown();
    });
}

async function loadSavedMeals() {
    try {
        const res = await apiFetch('/api/meals');
        const data = await res.json();
        const container = document.getElementById('savedMeals');

        if (data.status === 'success' && data.meals && data.meals.length > 0) {
            const rows = data.meals.map(meal => {
                const unitType = meal.unit_type || 'piece';
                const colors = getCalorieDensityColors(meal.calories_per_serving, meal.ounces_per_serving, unitType);
                return `<tr style="background-color:${colors.bg}">
                    <td class="border px-3 py-2 text-center text-gray-400 text-xs">${meal.id}</td>
                    <td class="border px-3 py-2 font-medium" style="color:${colors.text}">${meal.name}</td>
                    <td class="border px-3 py-2 text-center">${meal.calories_per_serving}</td>
                    <td class="border px-3 py-2 text-center">${meal.ounces_per_serving} ${unitType}</td>
                    <td class="border px-3 py-2 text-center">
                        <button onclick="deleteMealTemplate(${meal.id}, '${meal.name.replace(/'/g, "\\'")}')"
                            class="text-red-500 hover:text-red-700 transition-colors" title="Delete">
                            <svg class="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </td>
                </tr>`;
            }).join('');

            container.innerHTML = `
                <div class="overflow-x-auto">
                    <table class="w-full border-collapse text-sm">
                        <thead>
                            <tr class="bg-gray-100">
                                <th class="border px-3 py-2 text-center font-semibold w-12">ID</th>
                                <th class="border px-3 py-2 text-left font-semibold">Template Name</th>
                                <th class="border px-3 py-2 text-center font-semibold">Cal/Unit</th>
                                <th class="border px-3 py-2 text-center font-semibold">Units/Serving</th>
                                <th class="border px-3 py-2 text-center font-semibold w-16">Actions</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        } else {
            container.innerHTML = '<div class="text-gray-400 text-center py-4 text-sm">No saved templates yet.</div>';
        }
    } catch (err) {
        document.getElementById('savedMeals').innerHTML = '<div class="text-red-500 text-center py-4 text-sm">Error loading templates</div>';
    }
}

async function deleteMealTemplate(id, name) {
    if (!confirm(`Delete the template "${name}"?`)) return;
    try {
        const res = await apiDelete(`/api/meals/${id}`);
        const data = await res.json();
        if (data.status === 'success') {
            loadSavedMeals();
            updateMealSelect();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ==============================================
//  FORM HANDLERS
// ==============================================

// Add food template
document.getElementById('addMealForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
        const res = await apiPost('/api/meals', {
            name: form.name.value,
            calories_per_serving: form.calories_per_serving.value,
            ounces_per_serving: form.ounces_per_serving.value,
            unit_type: form.unit_type.value
        });
        const data = await res.json();
        if (data.status === 'success') {
            form.reset();
            updateMealSelect();
            loadSavedMeals();
            document.getElementById('addMealMsg').innerHTML = '<div class="msg-success text-sm">Food template added!</div>';
        } else {
            document.getElementById('addMealMsg').innerHTML = `<div class="msg-error text-sm">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('addMealMsg').innerHTML = `<div class="msg-error text-sm">${err.message}</div>`;
    }
});

// Log food template
document.getElementById('logMealForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const mealId = form.meal_id && form.meal_id.value ? parseInt(form.meal_id.value, 10) : null;
    const meal = mealId ? allMealsForSelect.find(m => m.id === mealId) : null;
    const units = parseFloat(form.ounces.value);

    if (!meal || !units) {
        document.getElementById('logMealMsg').innerHTML = '<div class="msg-error text-sm">Please select a template and enter quantity</div>';
        return;
    }

    const caloriesPerServing = meal.calories_per_serving;
    const ouncesPerServing = meal.ounces_per_serving || 1;
    const calories = Math.round((units * caloriesPerServing) / ouncesPerServing);

    try {
        const res = await apiPost('/api/meal_log', {
            meal_name: meal.name,
            date: form.date.value,
            calories: calories
        });
        const data = await res.json();
        if (data.status === 'success') {
            form.reset();
            document.getElementById('mealIdHidden').value = '';
            syncLogFormDatesToView();
            renderTodayMeals();
            document.getElementById('logMealMsg').innerHTML = '<div class="msg-success text-sm">Food logged!</div>';
        } else {
            document.getElementById('logMealMsg').innerHTML = `<div class="msg-error text-sm">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('logMealMsg').innerHTML = `<div class="msg-error text-sm">${err.message}</div>`;
    }
});

// Quick add
document.getElementById('quickAddForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
        const res = await apiPost('/api/quick_add', {
            name: form.name.value,
            calories: form.calories.value,
            date: form.date.value
        });
        const data = await res.json();
        if (data.status === 'success') {
            form.reset();
            syncLogFormDatesToView();
            renderTodayMeals();
            document.getElementById('quickAddMsg').innerHTML = '<div class="msg-success text-sm">Quick add logged!</div>';
        } else {
            document.getElementById('quickAddMsg').innerHTML = `<div class="msg-error text-sm">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('quickAddMsg').innerHTML = `<div class="msg-error text-sm">${err.message}</div>`;
    }
});

// Log recipe
document.getElementById('logRecipeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const select = document.getElementById('recipeSelect');
    const opt = select.options[select.selectedIndex];
    const cookedOz = parseFloat(form.cooked_oz.value);

    if (!opt || !opt.value || !cookedOz || cookedOz <= 0) {
        document.getElementById('logRecipeMsg').innerHTML = '<div class="msg-error text-sm">Please select a recipe and enter cooked oz</div>';
        return;
    }

    const calPerOz = parseFloat(opt.dataset.calPerOz);
    const recipeName = opt.textContent.split(' (')[0];
    const calories = Math.round(cookedOz * calPerOz);

    try {
        const res = await apiPost('/api/meal_log', {
            meal_name: `Recipe: ${recipeName}`,
            date: form.date.value,
            calories
        });
        const data = await res.json();
        if (data.status === 'success') {
            form.reset();
            syncLogFormDatesToView();
            renderTodayMeals();
            document.getElementById('logRecipeMsg').innerHTML = '<div class="msg-success text-sm">Recipe logged!</div>';
        } else {
            document.getElementById('logRecipeMsg').innerHTML = `<div class="msg-error text-sm">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('logRecipeMsg').innerHTML = `<div class="msg-error text-sm">${err.message}</div>`;
    }
});

// Blood pressure
document.getElementById('bloodPressureForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
        const res = await apiPost('/api/blood_pressure', {
            systolic: parseInt(form.systolic.value),
            diastolic: parseInt(form.diastolic.value)
        });
        const data = await res.json();
        if (data.status === 'success') {
            form.reset();
            loadLatestBPReading();
            chartsRendered = false; // Force chart re-render
            document.getElementById('bloodPressureMsg').innerHTML = '<div class="msg-success text-sm">Blood pressure logged!</div>';
        } else {
            document.getElementById('bloodPressureMsg').innerHTML = `<div class="msg-error text-sm">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('bloodPressureMsg').innerHTML = `<div class="msg-error text-sm">${err.message}</div>`;
    }
});

// Weight log
document.getElementById('weightLogForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const weight = parseFloat(form.weight.value);
    if (!weight || weight < 50 || weight > 1000) {
        document.getElementById('weightLogMsg').innerHTML = '<div class="msg-error text-sm">Enter a valid weight (50-1000 lbs)</div>';
        return;
    }
    try {
        const res = await apiPost('/api/weight_log', { weight, date: form.date.value });
        const data = await res.json();
        if (data.status === 'success') {
            document.getElementById('weightLogMsg').innerHTML = '<div class="msg-success text-sm">Weight logged!</div>';
            loadTodayWeight();
            chartsRendered = false; // Force chart re-render
        } else {
            document.getElementById('weightLogMsg').innerHTML = `<div class="msg-error text-sm">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('weightLogMsg').innerHTML = `<div class="msg-error text-sm">${err.message}</div>`;
    }
});

// ==============================================
//  TODAY'S FOOD LOG
// ==============================================

let currentViewDate = new Date();

// Calendar (below food log): which year is shown (Wayback-style: all 12 months)
let calendarYear = currentViewDate.getFullYear();

async function renderTodayMeals() {
    const viewDate = getLocalDate(currentViewDate);

    try {
        const [mealRes, quickAddRes, closedRes] = await Promise.all([
            apiFetch(`/api/meal_log_for_day?date=${viewDate}`),
            apiFetch(`/api/quick_add_for_day?date=${viewDate}`),
            apiFetch(`/api/day_closed?date=${viewDate}`)
        ]);

        const mealData = await mealRes.json();
        const quickAddData = await quickAddRes.json();
        const closedData = await closedRes.json();
        const dayClosed = closedData.status === 'success' && closedData.closed === true;
        const container = document.getElementById('todayMeals');

        updateCompleteDaySection(dayClosed);

        const hasMeals = mealData.logs && mealData.logs.length > 0;
        const hasQuickAdds = quickAddData.logs && quickAddData.logs.length > 0;

        if (!hasMeals && !hasQuickAdds) {
            container.innerHTML = `
                <div class="text-gray-400 text-center py-4 text-sm">
                    No food logged for ${formatDisplayDate(currentViewDate)} yet.
                </div>
                ${generateDayNavigation()}`;
            updateCalorieSummaryFromTotal(0);
            return;
        }

        const items = [];
        if (hasMeals) {
            mealData.logs.forEach(log => {
                items.push({ ...log, type: 'meal', displayName: log.meal_name, icon: '🍽️', colorClass: 'text-indigo-600' });
            });
        }
        if (hasQuickAdds) {
            quickAddData.logs.forEach(log => {
                items.push({ ...log, type: 'quick_add', displayName: log.name, icon: '⚡', colorClass: 'text-amber-600' });
            });
        }

        const totalCalories = items.reduce((sum, item) => sum + item.calories, 0);

        const rows = items.map(item => {
            const delFn = item.type === 'meal' ? `deleteMealLog(${item.id})` : `deleteQuickAdd(${item.id})`;
            return `<tr class="hover:bg-gray-50">
                <td class="border px-3 py-2 text-sm">${item.icon} ${item.displayName}</td>
                <td class="border px-3 py-2 text-sm ${item.colorClass} font-semibold text-right">${Math.round(item.calories)}</td>
                <td class="border px-3 py-2 text-center">
                    <button onclick="${delFn}" class="text-red-400 hover:text-red-600 transition-colors" title="Delete">
                        <svg class="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </td>
            </tr>`;
        }).join('');

        container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="w-full border-collapse text-sm">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="border px-3 py-2 text-left font-semibold">Food Item</th>
                            <th class="border px-3 py-2 text-right font-semibold">Calories</th>
                            <th class="border px-3 py-2 text-center font-semibold w-12"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <div class="flex justify-between items-center mt-3">
                    <div class="text-lg font-bold text-green-700">Total: ${Math.round(totalCalories)} cal</div>
                    ${generateDayNavigation()}
                </div>
            </div>`;

        updateCalorieSummaryFromTotal(totalCalories);
    } catch (err) {
        console.error('Error rendering meals:', err);
    }
}

function updateCalorieSummaryFromTotal(total) {
    // Only update if we're viewing today
    if (getLocalDate(currentViewDate) === getTodayLocalDate()) {
        updateCalorieSummary(total, getCalorieGoal());
    }
}

/** Renders the big "Complete day" section at the top of the Today tab (above Quick Add). */
function updateCompleteDaySection(dayClosed) {
    const el = document.getElementById('completeDaySection');
    if (!el) return;
    const dateLabel = formatDisplayDate(currentViewDate);
    if (dayClosed) {
        el.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="text-lg font-semibold text-gray-800">Log for ${dateLabel}</div>
                <span class="inline-flex items-center justify-center px-4 py-3 rounded-lg text-base font-medium text-emerald-700 bg-emerald-50 border border-emerald-200" title="Log for this day is marked complete">
                    Day complete
                </span>
            </div>`;
    } else {
        el.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="text-lg font-semibold text-gray-800">Log for ${dateLabel}</div>
                <button type="button" onclick="closeDay()" class="w-full sm:w-auto btn-success text-base font-medium py-3 px-6 rounded-lg" title="Mark this day's log as complete so it doesn't look like you ate less">
                    Complete day
                </button>
            </div>`;
    }
}

function generateDayNavigation() {
    const today = new Date();
    const isToday = getLocalDate(currentViewDate) === getLocalDate(today);
    const nextDisabled = isToday;
    const dateLabel = formatDisplayDate(currentViewDate);

    return `
        <div class="flex items-center gap-2 flex-wrap">
            <button onclick="goToPreviousDay()" class="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors" title="Previous day">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <span class="text-sm font-semibold text-gray-700 min-w-[80px] text-center">${dateLabel}</span>
            <button onclick="goToNextDay()" class="p-1.5 rounded hover:bg-gray-100 transition-colors ${nextDisabled ? 'text-gray-300 cursor-default' : 'text-gray-600'}" title="Next day">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
            </button>
            <button onclick="goToToday()" class="btn-primary text-xs py-1 px-2">Today</button>
        </div>`;
}

async function renderFoodLogCalendar() {
    const container = document.getElementById('foodLogCalendar');
    if (!container) return;

    const yearLabel = document.getElementById('calendarYearLabel');
    if (yearLabel) yearLabel.textContent = calendarYear;

    const viewDateStr = getLocalDate(currentViewDate);
    const todayStr = getTodayLocalDate();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const weekdayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const start = `${calendarYear}-01-01`;
    const end = `${calendarYear}-12-31`;
    let datesWithData = new Set();
    try {
        const res = await apiFetch(`/api/calories_range?start=${start}&end=${end}`);
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.data)) {
            data.data.forEach(({ date }) => { datesWithData.add(date); });
        }
    } catch (err) {
        console.error('Calendar: could not load dates with data', err);
    }

    function buildMonthGrid(month1Based) {
        const first = new Date(calendarYear, month1Based - 1, 1);
        const last = new Date(calendarYear, month1Based, 0);
        const daysInMonth = last.getDate();
        let startDow = first.getDay();

        let headerRow = '<tr class="bg-gray-100 border-b border-gray-200">';
        weekdayHeaders.forEach(d => { headerRow += `<th class="border border-gray-200 px-0.5 py-1 text-center text-[10px] font-semibold text-gray-500 w-6">${d}</th>`; });
        headerRow += '</tr>';

        let body = '<tr>';
        let cellCount = 0;
        for (let i = 0; i < startDow; i++) {
            body += '<td class="border border-gray-200 p-0 text-center text-[10px] text-gray-300 w-6 h-5"></td>';
            cellCount++;
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${calendarYear}-${String(month1Based).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasData = datesWithData.has(dateStr);
            const isSelected = dateStr === viewDateStr;
            const isToday = dateStr === todayStr;

            if (hasData) {
                const btnClass = isSelected
                    ? 'inline-block w-full py-0.5 rounded text-[10px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700'
                    : isToday
                        ? 'inline-block w-full py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
                        : 'inline-block w-full py-0.5 rounded text-[10px] text-indigo-600 hover:bg-indigo-50 hover:underline';
                body += `<td class="border border-gray-200 p-0 text-center w-6 h-5 align-middle">
                    <button type="button" class="${btnClass}" data-year="${calendarYear}" data-month="${month1Based}" data-day="${day}" aria-label="Load ${dateStr}">${day}</button>
                </td>`;
            } else {
                const spanClass = isToday ? 'text-[10px] text-gray-400 font-medium' : 'text-[10px] text-gray-300';
                body += `<td class="border border-gray-200 p-0 text-center w-6 h-5 align-middle"><span class="${spanClass}">${day}</span></td>`;
            }
            cellCount++;
            if (cellCount % 7 === 0) body += '</tr><tr>';
        }
        while (cellCount % 7 !== 0) {
            body += '<td class="border border-gray-200 p-0 text-center w-6 h-5"></td>';
            cellCount++;
        }
        body += '</tr>';

        return `<table class="border-collapse text-sm border border-gray-200">${headerRow}${body}</table>`;
    }

    let grid = '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">';
    for (let m = 1; m <= 12; m++) {
        grid += `<div class="flex flex-col">
            <div class="text-xs font-semibold text-gray-700 mb-1">${monthNames[m - 1]}</div>
            ${buildMonthGrid(m)}
        </div>`;
    }
    grid += '</div>';

    container.innerHTML = grid;

    container.querySelectorAll('button[data-year][data-month][data-day]').forEach(btn => {
        btn.addEventListener('click', () => {
            const y = parseInt(btn.getAttribute('data-year'), 10);
            const m = parseInt(btn.getAttribute('data-month'), 10);
            const d = parseInt(btn.getAttribute('data-day'), 10);
            goToCalendarDay(y, m, d);
        });
    });
}

function goToCalendarDay(year, month, day) {
    currentViewDate = new Date(year, month - 1, day);
    calendarYear = year;
    syncLogFormDatesToView();
    renderTodayMeals();
    renderFoodLogCalendar();
}

async function closeDay() {
    const viewDate = getLocalDate(currentViewDate);
    try {
        const res = await apiPost('/api/close_day', { date: viewDate });
        const data = await res.json();
        if (data.status === 'success') {
            renderTodayMeals();
        } else {
            alert('Error: ' + (data.message || 'Could not close day'));
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function goToPreviousDay() {
    currentViewDate.setDate(currentViewDate.getDate() - 1);
    syncLogFormDatesToView();
    renderTodayMeals();
}

function goToNextDay() {
    if (getLocalDate(currentViewDate) !== getLocalDate(new Date())) {
        currentViewDate.setDate(currentViewDate.getDate() + 1);
        syncLogFormDatesToView();
        renderTodayMeals();
    }
}

function goToToday() {
    currentViewDate = new Date();
    syncLogFormDatesToView();
    renderTodayMeals();
}

async function deleteMealLog(id) {
    if (!confirm('Delete this meal entry?')) return;
    try {
        const res = await apiDelete(`/api/meal_log/${id}`);
        const data = await res.json();
        if (data.status === 'success') renderTodayMeals();
        else alert('Error: ' + data.message);
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function deleteQuickAdd(id) {
    if (!confirm('Delete this quick add entry?')) return;
    try {
        const res = await apiDelete(`/api/quick_add/${id}`);
        const data = await res.json();
        if (data.status === 'success') renderTodayMeals();
        else alert('Error: ' + data.message);
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ==============================================
//  RECIPE BUILDER
// ==============================================

let recipeItems = [];
let recipesLoaded = false;

// Populate the template dropdown on the Recipes tab
async function updateRecipeTemplateSelect() {
    try {
        const res = await apiFetch('/api/meals');
        const data = await res.json();
        const select = document.getElementById('recipeTemplateSelect');
        if (!select) return;
        select.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.textContent = 'Select a food template...';
        placeholder.value = '';
        placeholder.disabled = true;
        placeholder.selected = true;
        select.appendChild(placeholder);

        if (!data.meals || data.meals.length === 0) return;
        data.meals.forEach(meal => {
            const option = document.createElement('option');
            const unitType = meal.unit_type || 'piece';
            option.value = meal.id;
            option.textContent = `${meal.name} (${meal.calories_per_serving} cal/${meal.ounces_per_serving} ${unitType})`;
            option.dataset.name = meal.name;
            option.dataset.cal = meal.calories_per_serving;
            option.dataset.serving = meal.ounces_per_serving;
            option.dataset.unit = unitType;
            const colors = getCalorieDensityColors(meal.calories_per_serving, meal.ounces_per_serving, unitType);
            option.style.backgroundColor = colors.bg;
            option.style.color = colors.text;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Error loading recipe template select:', err);
    }
}

function addTemplateToRecipe() {
    const select = document.getElementById('recipeTemplateSelect');
    const qtyInput = document.getElementById('recipeTemplateQty');
    const opt = select.options[select.selectedIndex];
    if (!opt || !opt.value) return;
    const qty = parseFloat(qtyInput.value);
    if (!qty || qty <= 0) return;

    const calPerServing = parseFloat(opt.dataset.cal);
    const servingSize = parseFloat(opt.dataset.serving);
    const calPerUnit = servingSize > 0 ? calPerServing / servingSize : calPerServing;

    recipeItems.push({
        source_type: 'template',
        template_id: parseInt(opt.value),
        name: opt.dataset.name,
        calories_per_unit: calPerUnit,
        unit_type: opt.dataset.unit,
        quantity: qty
    });

    qtyInput.value = '';
    select.selectedIndex = 0;
    renderRecipeItems();
}

function addCustomToRecipe() {
    const name = document.getElementById('recipeCustomName').value.trim();
    const cal = parseFloat(document.getElementById('recipeCustomCal').value);
    const unit = document.getElementById('recipeCustomUnit').value;
    const qty = parseFloat(document.getElementById('recipeCustomQty').value);

    if (!name || !cal || !qty || qty <= 0) return;

    recipeItems.push({
        source_type: 'custom',
        template_id: null,
        name,
        calories_per_unit: cal,
        unit_type: unit,
        quantity: qty
    });

    document.getElementById('recipeCustomName').value = '';
    document.getElementById('recipeCustomCal').value = '';
    document.getElementById('recipeCustomQty').value = '';
    renderRecipeItems();
}

function removeRecipeItem(index) {
    recipeItems.splice(index, 1);
    renderRecipeItems();
}

function renderRecipeItems() {
    const container = document.getElementById('recipeItemsContainer');
    const totalCalEl = document.getElementById('recipeTotalCalories');
    const calPerOzEl = document.getElementById('recipeCalPerOz');
    const cookedWeightInput = document.getElementById('recipeCookedWeight');

    if (recipeItems.length === 0) {
        container.innerHTML = '<div class="text-gray-400 text-center py-4 text-sm">No items added yet. Add items above to build your recipe.</div>';
        totalCalEl.textContent = '0 cal';
        calPerOzEl.textContent = '-- cal/oz';
        return;
    }

    const totalCal = recipeItems.reduce((sum, item) => sum + (item.calories_per_unit * item.quantity), 0);
    totalCalEl.textContent = `${Math.round(totalCal)} cal`;

    const cookedWeight = parseFloat(cookedWeightInput.value) || 0;
    if (cookedWeight > 0) {
        const calPerOz = totalCal / cookedWeight;
        calPerOzEl.textContent = `${calPerOz.toFixed(1)} cal/oz`;
    } else {
        calPerOzEl.textContent = '-- cal/oz';
    }

    const rows = recipeItems.map((item, idx) => {
        const itemCal = Math.round(item.calories_per_unit * item.quantity);
        const colors = getCalorieDensityColors(item.calories_per_unit, 1, item.unit_type);
        const sourceIcon = item.source_type === 'template' ? '📋' : '✏️';
        return `<tr style="background-color:${colors.bg}">
            <td class="border px-3 py-2 text-sm" style="color:${colors.text}">${sourceIcon} ${item.name}</td>
            <td class="border px-3 py-2 text-sm text-center">${item.calories_per_unit}/${item.unit_type}</td>
            <td class="border px-3 py-2 text-sm text-center">${item.quantity}</td>
            <td class="border px-3 py-2 text-sm text-center font-semibold">${itemCal}</td>
            <td class="border px-3 py-2 text-center">
                <button onclick="removeRecipeItem(${idx})" class="text-red-500 hover:text-red-700 transition-colors" title="Remove">
                    <svg class="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm">
                <thead>
                    <tr class="bg-gray-100">
                        <th class="border px-3 py-2 text-left font-semibold">Item</th>
                        <th class="border px-3 py-2 text-center font-semibold">Cal/Unit</th>
                        <th class="border px-3 py-2 text-center font-semibold">Qty</th>
                        <th class="border px-3 py-2 text-center font-semibold">Total Cal</th>
                        <th class="border px-3 py-2 text-center font-semibold w-12"></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

async function saveRecipe() {
    const name = document.getElementById('recipeName').value.trim();
    const cookedWeight = parseFloat(document.getElementById('recipeCookedWeight').value);
    const msgEl = document.getElementById('saveRecipeMsg');

    if (!name) {
        msgEl.innerHTML = '<div class="msg-error text-sm">Please enter a recipe name</div>';
        return;
    }
    if (recipeItems.length === 0) {
        msgEl.innerHTML = '<div class="msg-error text-sm">Add at least one item to the recipe</div>';
        return;
    }
    if (!cookedWeight || cookedWeight <= 0) {
        msgEl.innerHTML = '<div class="msg-error text-sm">Enter the cooked total weight in ounces</div>';
        return;
    }

    try {
        const res = await apiPost('/api/recipes', {
            name,
            cooked_weight_oz: cookedWeight,
            items: recipeItems
        });
        const data = await res.json();
        if (data.status === 'success') {
            msgEl.innerHTML = '<div class="msg-success text-sm">Recipe saved!</div>';
            // Reset builder
            document.getElementById('recipeName').value = '';
            document.getElementById('recipeCookedWeight').value = '';
            recipeItems = [];
            renderRecipeItems();
            loadSavedRecipes();
            updateRecipeSelect();
        } else {
            msgEl.innerHTML = `<div class="msg-error text-sm">${data.message}</div>`;
        }
    } catch (err) {
        msgEl.innerHTML = `<div class="msg-error text-sm">${err.message}</div>`;
    }
}

async function loadSavedRecipes() {
    try {
        const res = await apiFetch('/api/recipes');
        const data = await res.json();
        const container = document.getElementById('savedRecipes');
        if (!container) return;

        if (data.status === 'success' && data.recipes && data.recipes.length > 0) {
            const rows = data.recipes.map(recipe => {
                const colors = getCalorieDensityColors(recipe.cal_per_oz, 1, 'ounce');
                return `<tr style="background-color:${colors.bg}">
                    <td class="border px-3 py-2 font-medium" style="color:${colors.text}">${recipe.name}</td>
                    <td class="border px-3 py-2 text-center">${Math.round(recipe.total_calories)}</td>
                    <td class="border px-3 py-2 text-center">${recipe.cooked_weight_oz} oz</td>
                    <td class="border px-3 py-2 text-center font-semibold">${recipe.cal_per_oz.toFixed(1)}</td>
                    <td class="border px-3 py-2 text-center text-xs text-gray-500">${recipe.items ? recipe.items.length : 0}</td>
                    <td class="border px-3 py-2 text-center">
                        <button onclick="deleteRecipe(${recipe.id}, '${recipe.name.replace(/'/g, "\\'")}')"
                            class="text-red-500 hover:text-red-700 transition-colors" title="Delete">
                            <svg class="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </td>
                </tr>`;
            }).join('');

            container.innerHTML = `
                <div class="overflow-x-auto">
                    <table class="w-full border-collapse text-sm">
                        <thead>
                            <tr class="bg-gray-100">
                                <th class="border px-3 py-2 text-left font-semibold">Recipe</th>
                                <th class="border px-3 py-2 text-center font-semibold">Total Cal</th>
                                <th class="border px-3 py-2 text-center font-semibold">Cooked Weight</th>
                                <th class="border px-3 py-2 text-center font-semibold">Cal/Oz</th>
                                <th class="border px-3 py-2 text-center font-semibold">Items</th>
                                <th class="border px-3 py-2 text-center font-semibold w-12"></th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        } else {
            container.innerHTML = '<div class="text-gray-400 text-center py-4 text-sm">No saved recipes yet.</div>';
        }
    } catch (err) {
        const container = document.getElementById('savedRecipes');
        if (container) container.innerHTML = '<div class="text-red-500 text-center py-4 text-sm">Error loading recipes</div>';
    }
}

async function deleteRecipe(id, name) {
    if (!confirm(`Delete the recipe "${name}"?`)) return;
    try {
        const res = await apiDelete(`/api/recipes/${id}`);
        const data = await res.json();
        if (data.status === 'success') {
            loadSavedRecipes();
            updateRecipeSelect();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ==============================================
//  RECIPE SELECT & LOG (Today tab)
// ==============================================

let cachedRecipes = [];

async function updateRecipeSelect() {
    try {
        const res = await apiFetch('/api/recipes');
        const data = await res.json();
        const select = document.getElementById('recipeSelect');
        if (!select) return;
        select.innerHTML = '';

        cachedRecipes = (data.status === 'success' && data.recipes) ? data.recipes : [];

        if (cachedRecipes.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = 'No recipes yet';
            opt.disabled = true;
            select.appendChild(opt);
            return;
        }

        cachedRecipes.forEach(recipe => {
            const option = document.createElement('option');
            option.value = recipe.id;
            option.textContent = `${recipe.name} (${recipe.cal_per_oz.toFixed(1)} cal/oz, ${recipe.cooked_weight_oz} oz cooked)`;
            option.dataset.calPerOz = recipe.cal_per_oz;
            option.dataset.totalCal = recipe.total_calories;
            option.dataset.cookedWeight = recipe.cooked_weight_oz;
            const colors = getCalorieDensityColors(recipe.cal_per_oz, 1, 'ounce');
            option.style.backgroundColor = colors.bg;
            option.style.color = colors.text;
            select.appendChild(option);
        });

        updateRecipeHint();
    } catch (err) {
        console.error('Error loading recipe select:', err);
    }
}

function updateRecipeHint() {
    const select = document.getElementById('recipeSelect');
    const hint = document.getElementById('recipeHint');
    const opt = select && select.options[select.selectedIndex];
    if (!opt || !opt.dataset.calPerOz) {
        if (hint) hint.textContent = '';
        return;
    }
    if (hint) hint.textContent = `${parseFloat(opt.dataset.calPerOz).toFixed(1)} cal per cooked oz · ${Math.round(parseFloat(opt.dataset.totalCal))} total cal`;
    updateRecipeLiveCalc();
}

function updateRecipeLiveCalc() {
    const select = document.getElementById('recipeSelect');
    const ozInput = document.querySelector('#logRecipeForm input[name="cooked_oz"]');
    const liveCalc = document.getElementById('recipeCalcLive');
    const opt = select && select.options[select.selectedIndex];
    const oz = parseFloat(ozInput && ozInput.value || '0');

    if (!opt || !opt.dataset.calPerOz || !(oz > 0)) {
        if (liveCalc) liveCalc.textContent = '';
        return;
    }

    const calPerOz = parseFloat(opt.dataset.calPerOz);
    const total = Math.round(oz * calPerOz);
    if (liveCalc) liveCalc.textContent = `${oz} oz = ${total} cal`;
}

// ==============================================
//  WEIGHT DATA
// ==============================================

async function loadTodayWeight() {
    try {
        const today = getTodayLocalDate();
        const res = await apiFetch(`/api/weight_log_for_day?date=${today}`);
        const data = await res.json();
        const el = document.getElementById('todayWeight');
        if (data.status === 'success' && data.weight) {
            el.innerHTML = `<span class="text-lg font-bold">${data.weight} lbs</span>`;
        } else {
            el.innerHTML = '<span class="text-gray-400">No weight logged today</span>';
        }
    } catch (err) {
        console.error('Error loading weight:', err);
    }
}

async function loadRecentWeights() {
    try {
        const res = await apiFetch('/api/weight_log_all');
        const data = await res.json();
        const tbody = document.getElementById('recentWeightsTbody');
        if (data.status === 'success' && data.weights && data.weights.length > 0) {
            tbody.innerHTML = data.weights.map(w =>
                `<tr class="hover:bg-gray-50"><td class="border px-3 py-1.5">${w.date}</td><td class="border px-3 py-1.5">${w.weight} lbs</td></tr>`
            ).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="2" class="text-gray-400 text-center py-3 text-sm">No weight entries</td></tr>';
        }
    } catch (err) {
        console.error('Error loading weights:', err);
    }
}

// ==============================================
//  BLOOD PRESSURE
// ==============================================

async function loadLatestBPReading() {
    try {
        const res = await apiFetch('/api/blood_pressure_latest');
        const data = await res.json();
        const container = document.getElementById('latestBPReading');

        if (data.status === 'success' && data.reading) {
            const r = data.reading;
            const ts = new Date(r.timestamp).toLocaleString();
            let category, color;
            if (r.systolic < 120 && r.diastolic < 80) { category = 'Normal'; color = 'text-green-600'; }
            else if (r.systolic < 130 && r.diastolic < 80) { category = 'Elevated'; color = 'text-yellow-600'; }
            else if (r.systolic < 140 || r.diastolic < 90) { category = 'High (Stage 1)'; color = 'text-orange-600'; }
            else { category = 'High (Stage 2)'; color = 'text-red-600'; }

            container.innerHTML = `
                <div class="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div class="text-3xl font-bold text-red-600">${r.systolic}</div>
                        <div class="text-xs text-gray-500">Systolic</div>
                    </div>
                    <div>
                        <div class="text-3xl font-bold text-red-600">${r.diastolic}</div>
                        <div class="text-xs text-gray-500">Diastolic</div>
                    </div>
                    <div>
                        <div class="text-lg font-semibold ${color}">${category}</div>
                        <div class="text-xs text-gray-400">${ts}</div>
                    </div>
                </div>`;
        } else {
            container.innerHTML = '<div class="text-gray-400 text-sm">No readings yet</div>';
        }
    } catch (err) {
        document.getElementById('latestBPReading').innerHTML = '<div class="text-red-500 text-sm">Error loading</div>';
    }
}

// ==============================================
//  CALENDAR
// ==============================================

async function loadCalendar() {
    const start = document.getElementById('calendarStart').value;
    const end = document.getElementById('calendarEnd').value;
    if (!start || !end) return;

    try {
        const res = await apiFetch(`/api/calories_range?start=${start}&end=${end}`);
        const data = await res.json();
        const tbody = document.querySelector('#calendarTable tbody');
        tbody.innerHTML = '';
        if (!data.data || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" class="text-center py-4 text-gray-400 text-sm">No data for this range</td></tr>';
            return;
        }
        data.data.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            tr.innerHTML = `
                <td class="border px-3 py-2">${row.date}</td>
                <td class="border px-3 py-2 font-semibold text-indigo-600">${Math.round(row.total_calories)} cal</td>`;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error loading calendar:', err);
    }
}

// ==============================================
//  CHARTS
// ==============================================

function calculateTrendLine(weights) {
    if (weights.length < 2) return weights.map(w => w.weight);
    const n = weights.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const yValues = weights.map(w => w.weight);
    const xMean = xValues.reduce((a, b) => a + b, 0) / n;
    const yMean = yValues.reduce((a, b) => a + b, 0) / n;
    let numerator = 0, denominator = 0;
    for (let i = 0; i < n; i++) {
        numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
        denominator += (xValues[i] - xMean) ** 2;
    }
    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = yMean - slope * xMean;
    return xValues.map(x => slope * x + intercept);
}

async function loadWeightChart() {
    try {
        if (typeof ApexCharts === 'undefined') return;
        const res = await apiFetch('/api/weight_log_all');
        const data = await res.json();

        const chartEl = document.getElementById('weightChart');
        if (!chartEl) return;
        chartEl.innerHTML = '';
        if (window.weightChart && typeof window.weightChart.destroy === 'function') window.weightChart.destroy();

        if (data.status === 'success' && data.weights && data.weights.length > 0) {
            const sorted = [...data.weights].sort((a, b) => new Date(a.date) - new Date(b.date));
            const points = sorted.map(w => ({ x: new Date(w.date + 'T00:00:00').getTime(), y: w.weight }));
            const trend = calculateTrendLine(sorted);
            const trendPts = points.map((p, i) => ({ x: p.x, y: trend[i] }));

            window.weightChart = new ApexCharts(chartEl, {
                series: [
                    { name: 'Weight', data: points, type: 'line' },
                    { name: 'Trend', data: trendPts, type: 'line' }
                ],
                chart: { height: 280, type: 'line', animations: { enabled: false }, toolbar: { show: true } },
                colors: ['#4f46e5', '#ef4444'],
                stroke: { curve: 'straight', width: [3, 1], dashArray: [0, 5] },
                markers: { size: [3, 0] },
                xaxis: { type: 'datetime', title: { text: 'Date' } },
                yaxis: { title: { text: 'Weight (lbs)' }, labels: { formatter: v => v + ' lbs' } },
                tooltip: { y: { formatter: v => v + ' lbs' } },
                legend: { position: 'top' },
                grid: { borderColor: '#e5e7eb' }
            });
            window.weightChart.render();
        } else {
            chartEl.innerHTML = '<div class="text-gray-400 text-center py-8 text-sm">No weight data yet</div>';
        }
    } catch (err) {
        console.error('Weight chart error:', err);
    }
}

async function loadBloodPressureChart() {
    try {
        if (typeof ApexCharts === 'undefined') return;
        const res = await apiFetch('/api/blood_pressure_all');
        const data = await res.json();

        const chartEl = document.getElementById('bloodPressureChart');
        if (!chartEl) return;
        chartEl.innerHTML = '';
        if (window.bpChart && typeof window.bpChart.destroy === 'function') window.bpChart.destroy();

        if (data.status === 'success' && data.readings && data.readings.length > 0) {
            const readings = data.readings;
            const dates = readings.map(r => new Date(r.timestamp).toLocaleDateString());
            const systolic = readings.map(r => r.systolic);
            const diastolic = readings.map(r => r.diastolic);

            window.bpChart = new ApexCharts(chartEl, {
                series: [
                    { name: 'Systolic', data: systolic, type: 'line' },
                    { name: 'Diastolic', data: diastolic, type: 'line' }
                ],
                chart: { height: 280, type: 'line', toolbar: { show: true } },
                colors: ['#ef4444', '#3b82f6'],
                stroke: { curve: 'smooth', width: 3 },
                markers: { size: 3 },
                xaxis: { categories: dates, title: { text: 'Date' } },
                yaxis: { title: { text: 'mmHg' }, labels: { formatter: v => v + ' mmHg' }, min: 0, max: 200 },
                tooltip: { y: { formatter: v => v + ' mmHg' } },
                legend: { position: 'top' },
                grid: { borderColor: '#e5e7eb' }
            });
            window.bpChart.render();
        } else {
            chartEl.innerHTML = '<div class="text-gray-400 text-center py-8 text-sm">No blood pressure data yet</div>';
        }
    } catch (err) {
        console.error('BP chart error:', err);
    }
}

async function loadCaloriesChart() {
    try {
        if (typeof ApexCharts === 'undefined') return;
        const res = await apiFetch('/api/calories_all');
        const data = await res.json();

        const chartEl = document.getElementById('caloriesChart');
        if (!chartEl) return;
        chartEl.innerHTML = '';
        if (window.caloriesChart && typeof window.caloriesChart.destroy === 'function') window.caloriesChart.destroy();

        if (data.status === 'success' && data.data && data.data.length > 0) {
            const dates = data.data.map(c => c.date);
            const calories = data.data.map(c => c.total_calories);
            const start = dates[0];
            const end = dates[dates.length - 1];
            let closedSet = new Set();
            try {
                const closedRes = await apiFetch(`/api/closed_days_range?start=${start}&end=${end}`);
                const closedData = await closedRes.json();
                if (closedData.status === 'success' && closedData.dates) closedSet = new Set(closedData.dates);
            } catch (e) { /* ignore */ }
            const darkPurple = '#4c1d95';
            const lightPurple = '#a78bfa';
            const seriesData = dates.map((d, i) => ({
                x: d,
                y: calories[i],
                fillColor: closedSet.has(d) ? darkPurple : lightPurple
            }));

            window.caloriesChart = new ApexCharts(chartEl, {
                series: [{ name: 'Daily Calories', data: seriesData, type: 'column' }],
                chart: { height: 280, type: 'bar', toolbar: { show: true } },
                dataLabels: { enabled: false },
                xaxis: { categories: dates, title: { text: 'Date' } },
                yaxis: { title: { text: 'Calories' }, labels: { formatter: v => v + ' cal' } },
                tooltip: { y: { formatter: v => v + ' cal' } },
                legend: { position: 'top' },
                grid: { borderColor: '#e5e7eb' }
            });
            window.caloriesChart.render();
        } else {
            chartEl.innerHTML = '<div class="text-gray-400 text-center py-8 text-sm">No calorie data yet</div>';
        }
    } catch (err) {
        console.error('Calories chart error:', err);
    }
}

// ==============================================
//  DOCTOR'S REPORT
// ==============================================

async function generateDoctorsReport() {
    const reportContainer = document.getElementById('reportContainer');
    const reportContent = document.getElementById('reportContent');

    reportContent.innerHTML = `
        <div class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            <span class="ml-2 text-gray-500 text-sm">Generating report...</span>
        </div>`;
    reportContainer.classList.remove('hidden');

    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 13);
        const startStr = getLocalDate(startDate);
        const endStr = getLocalDate(endDate);
        const expanded = getExpandedDateRange(startStr, endStr);

        const [calData, weightData, bpData] = await Promise.all([
            apiFetch(`/api/calories_range?start=${startStr}&end=${endStr}`).then(r => r.json()),
            apiFetch(`/api/weight_log_range?start=${startStr}&end=${endStr}`).then(r => r.json()),
            apiFetch(`/api/blood_pressure_range?start=${expanded.start}&end=${expanded.end}`).then(r => r.json())
        ]);

        reportContent.innerHTML = generateReportHTML(startStr, endStr, calData, weightData, bpData);
    } catch (err) {
        reportContent.innerHTML = `<div class="msg-error text-sm">Error generating report: ${err.message}</div>`;
    }
}

function generateReportHTML(startDate, endDate, caloriesData, weightData, bpData) {
    const reportDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const caloriesMap = {};
    if (caloriesData.status === 'success' && caloriesData.data) {
        caloriesData.data.forEach(d => { caloriesMap[d.date] = d.total_calories; });
    }

    const weightMap = {};
    if (weightData.status === 'success' && weightData.weights) {
        weightData.weights.forEach(d => { weightMap[d.date] = d.weight; });
    }

    const bpReadings = [];
    if (bpData.status === 'success' && bpData.readings) {
        bpData.readings.forEach(r => {
            bpReadings.push({ date: getLocalDateFromUTC(r.timestamp), systolic: r.systolic, diastolic: r.diastolic, timestamp: r.timestamp });
        });
    }

    const dailyEntries = [];
    const cur = new Date(startDate);
    const endObj = new Date(endDate);
    while (cur <= endObj) {
        const ds = getLocalDate(cur);
        dailyEntries.push({
            date: ds,
            displayDate: cur.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            calories: caloriesMap[ds] || 0,
            weight: weightMap[ds] || null,
            bp: bpReadings.filter(bp => bp.date === ds)
        });
        cur.setDate(cur.getDate() + 1);
    }

    const totalCal = dailyEntries.reduce((s, d) => s + d.calories, 0);
    const avgCal = totalCal / dailyEntries.length;
    const daysWithData = dailyEntries.filter(d => d.calories > 0).length;
    const weights = dailyEntries.filter(d => d.weight !== null).map(d => d.weight);
    const avgW = weights.length > 0 ? weights.reduce((s, w) => s + w, 0) / weights.length : null;
    const avgSys = bpReadings.length > 0 ? bpReadings.reduce((s, r) => s + r.systolic, 0) / bpReadings.length : null;
    const avgDia = bpReadings.length > 0 ? bpReadings.reduce((s, r) => s + r.diastolic, 0) / bpReadings.length : null;

    return `
        <div style="font-family: 'Times New Roman', serif; line-height: 1.6;">
            <div class="text-center mb-6 border-b-2 pb-4">
                <h1 class="text-2xl font-bold text-gray-800 mb-1">Health Data Report</h1>
                <p class="text-gray-600 text-sm">${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</p>
                <p class="text-xs text-gray-400">Generated: ${reportDate}</p>
            </div>
            <div class="grid grid-cols-3 gap-3 mb-6">
                <div class="bg-blue-50 p-3 rounded-lg border border-blue-200 text-center">
                    <div class="text-xs text-blue-600 font-medium">Avg Calories</div>
                    <div class="text-xl font-bold text-blue-700">${Math.round(avgCal)}</div>
                    <div class="text-xs text-blue-500">${daysWithData} days tracked</div>
                </div>
                <div class="bg-green-50 p-3 rounded-lg border border-green-200 text-center">
                    <div class="text-xs text-green-600 font-medium">Avg Weight</div>
                    <div class="text-xl font-bold text-green-700">${avgW ? avgW.toFixed(1) + ' lbs' : 'N/A'}</div>
                    <div class="text-xs text-green-500">${weights.length} entries</div>
                </div>
                <div class="bg-red-50 p-3 rounded-lg border border-red-200 text-center">
                    <div class="text-xs text-red-600 font-medium">Avg BP</div>
                    <div class="text-xl font-bold text-red-700">${avgSys ? Math.round(avgSys) + '/' + Math.round(avgDia) : 'N/A'}</div>
                    <div class="text-xs text-red-500">${bpReadings.length} readings</div>
                </div>
            </div>
            <table class="w-full border-collapse text-sm mb-6">
                <thead>
                    <tr class="bg-gray-100">
                        <th class="border px-2 py-1.5 text-left font-semibold">Date</th>
                        <th class="border px-2 py-1.5 text-center font-semibold">Calories</th>
                        <th class="border px-2 py-1.5 text-center font-semibold">Weight</th>
                        <th class="border px-2 py-1.5 text-center font-semibold">BP</th>
                    </tr>
                </thead>
                <tbody>
                    ${dailyEntries.map(d => `
                        <tr class="hover:bg-gray-50">
                            <td class="border px-2 py-1.5">${d.displayDate}</td>
                            <td class="border px-2 py-1.5 text-center">${d.calories > 0 ? Math.round(d.calories) : '-'}</td>
                            <td class="border px-2 py-1.5 text-center">${d.weight ? d.weight.toFixed(1) : '-'}</td>
                            <td class="border px-2 py-1.5 text-center">${d.bp.length > 0 ? d.bp.map(b => b.systolic + '/' + b.diastolic).join(', ') : '-'}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
            <div class="text-center text-xs text-gray-400 border-t pt-3">
                Generated by Dead Weight &bull; Consult your healthcare provider for medical advice
            </div>
        </div>`;
}

function printReport() {
    const content = document.getElementById('reportContent');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Health Report</title>
        <style>body{font-family:'Times New Roman',serif;margin:20px;line-height:1.6}
        table{width:100%;border-collapse:collapse;margin:20px 0}
        th,td{border:1px solid #ccc;padding:8px;text-align:left}
        th{background:#f5f5f5;font-weight:bold}
        @media print{body{margin:0}.no-print{display:none}}</style>
        </head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
}

function downloadReport() { printReport(); }

// ==============================================
//  MIDNIGHT TIMER
// ==============================================

let midnightTimer = null;

function checkMidnightCrossing() {
    const currentDate = getTodayLocalDate();
    const dateInputs = [
        document.getElementById('logDate'),
        document.getElementById('quickAddDate'),
        document.getElementById('weightLogDate'),
        document.getElementById('logRecipeDate')
    ].filter(Boolean);

    let needsUpdate = false;
    dateInputs.forEach(input => {
        if (input.value !== currentDate) {
            input.value = currentDate;
            needsUpdate = true;
        }
    });

    if (needsUpdate) {
        renderTodayMeals();
        loadTodayWeight();
    }
}

function startMidnightTimer() {
    if (midnightTimer) clearInterval(midnightTimer);
    midnightTimer = setInterval(checkMidnightCrossing, 60000);
    checkMidnightCrossing();
}

// ==============================================
//  CALORIE GOAL (server-backed)
// ==============================================

async function loadCalorieGoalFromServer() {
    try {
        const res = await apiFetch('/api/preferences');
        const data = await res.json();
        if (data.status === 'success' && data.preferences && data.preferences.daily_calorie_goal) {
            const n = parseInt(data.preferences.daily_calorie_goal, 10);
            if (Number.isFinite(n) && n > 0) {
                setCalorieGoal(n);
            }
        }
    } catch (err) {
        console.error('Error loading calorie goal:', err);
    }
}

async function saveCalorieGoalToServer(goal) {
    try {
        await apiPost('/api/preferences', { key: 'daily_calorie_goal', value: String(Math.round(goal)) });
    } catch (err) {
        console.error('Error saving calorie goal:', err);
    }
}

// ==============================================
//  APP INITIALIZATION
// ==============================================

async function initApp() {
    // Reset chart state so they re-render
    chartsRendered = false;

    // Load calorie goal from server preferences
    await loadCalorieGoalFromServer();

    const goalInput = document.getElementById('calorieGoalInput');
    if (goalInput) goalInput.value = getCalorieGoal();
    updateCalorieSummary(0, getCalorieGoal());

    // Save goal button
    const saveBtn = document.getElementById('saveCalorieGoal');
    if (saveBtn) {
        // Remove old listeners by cloning
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        newBtn.addEventListener('click', async () => {
            const n = parseInt(document.getElementById('calorieGoalInput').value, 10);
            if (!Number.isFinite(n) || n <= 0) return;
            setCalorieGoal(n);
            await saveCalorieGoalToServer(n);
            const totalText = (document.getElementById('todayCalories').textContent || '0').replace(/[^\d.]/g, '') || '0';
            updateCalorieSummary(parseFloat(totalText) || 0, getCalorieGoal());
        });
    }

    // Set today's dates
    setTodayForLogDate();
    const weightLogDate = document.getElementById('weightLogDate');
    if (weightLogDate) weightLogDate.value = getTodayLocalDate();

    // Set calendar defaults
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 6);
    const calEnd = document.getElementById('calendarEnd');
    const calStart = document.getElementById('calendarStart');
    if (calEnd) calEnd.value = getLocalDate(today);
    if (calStart) calStart.value = getLocalDate(weekAgo);

    // Hook up unit UI and meal combobox
    const ouncesInput = document.querySelector('#logMealForm input[name="ounces"]');
    if (ouncesInput) ouncesInput.addEventListener('input', updateLiveCalc);
    setupMealCombobox();
    setupAiAdvisorCopyButtons();

    // Hook up recipe select events
    const recipeSelect = document.getElementById('recipeSelect');
    const recipeOzInput = document.querySelector('#logRecipeForm input[name="cooked_oz"]');
    if (recipeSelect) recipeSelect.addEventListener('change', updateRecipeHint);
    if (recipeOzInput) recipeOzInput.addEventListener('input', updateRecipeLiveCalc);

    // Hook up recipe builder buttons
    const addTemplateBtn = document.getElementById('addTemplateToRecipeBtn');
    if (addTemplateBtn) {
        const newBtn = addTemplateBtn.cloneNode(true);
        addTemplateBtn.parentNode.replaceChild(newBtn, addTemplateBtn);
        newBtn.addEventListener('click', addTemplateToRecipe);
    }
    const addCustomBtn = document.getElementById('addCustomToRecipeBtn');
    if (addCustomBtn) {
        const newBtn = addCustomBtn.cloneNode(true);
        addCustomBtn.parentNode.replaceChild(newBtn, addCustomBtn);
        newBtn.addEventListener('click', addCustomToRecipe);
    }
    const saveRecipeBtn = document.getElementById('saveRecipeBtn');
    if (saveRecipeBtn) {
        const newBtn = saveRecipeBtn.cloneNode(true);
        saveRecipeBtn.parentNode.replaceChild(newBtn, saveRecipeBtn);
        newBtn.addEventListener('click', saveRecipe);
    }
    const cookedWeightInput = document.getElementById('recipeCookedWeight');
    if (cookedWeightInput) cookedWeightInput.addEventListener('input', renderRecipeItems);

    // Reset recipe builder state
    recipesLoaded = false;
    recipeItems = [];

    // Load data
    updateMealSelect();
    updateRecipeSelect();
    renderTodayMeals();
    loadSavedMeals();
    loadLatestBPReading();
    loadTodayWeight();

    // Event listeners
    const loadCalBtn = document.getElementById('loadCalendar');
    if (loadCalBtn) {
        const newBtn = loadCalBtn.cloneNode(true);
        loadCalBtn.parentNode.replaceChild(newBtn, loadCalBtn);
        newBtn.addEventListener('click', loadCalendar);
    }

    const genReportBtn = document.getElementById('generateReport');
    if (genReportBtn) {
        const newBtn = genReportBtn.cloneNode(true);
        genReportBtn.parentNode.replaceChild(newBtn, genReportBtn);
        newBtn.addEventListener('click', generateDoctorsReport);
    }

    const printBtn = document.getElementById('printReport');
    if (printBtn) {
        const newBtn = printBtn.cloneNode(true);
        printBtn.parentNode.replaceChild(newBtn, printBtn);
        newBtn.addEventListener('click', printReport);
    }

    const dlBtn = document.getElementById('downloadReport');
    if (dlBtn) {
        const newBtn = dlBtn.cloneNode(true);
        dlBtn.parentNode.replaceChild(newBtn, dlBtn);
        newBtn.addEventListener('click', downloadReport);
    }

    // Food log calendar year navigation
    const calPrevYear = document.getElementById('calendarPrevYear');
    const calNextYear = document.getElementById('calendarNextYear');
    if (calPrevYear) calPrevYear.addEventListener('click', () => { calendarYear -= 1; renderFoodLogCalendar(); });
    if (calNextYear) calNextYear.addEventListener('click', () => { calendarYear += 1; renderFoodLogCalendar(); });

    // Switch to Today tab
    switchTab('today');

    // Start midnight timer
    startMidnightTimer();
}

// ==============================================
//  BOOT
// ==============================================

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

window.addEventListener('beforeunload', () => {
    if (midnightTimer) clearInterval(midnightTimer);
});
