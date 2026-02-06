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

const apiDelete = async (url) => {
    return apiFetch(url, { method: 'DELETE' });
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
        }).catch(() => {});
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
            if (data.migratedData) {
                authMsg.innerHTML = '<div class="msg-success text-sm">Account created with your existing data!</div>';
                setTimeout(() => showAppScreen(data.username), 1500);
            } else {
                showAppScreen(data.username);
            }
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
    if (logDateInput) logDateInput.value = today;
    if (quickAddDateInput) quickAddDateInput.value = today;
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

function updateUnitUI() {
    const mealSelect = document.getElementById('mealSelect');
    const unitLabel = document.getElementById('selectedUnitLabel');
    const unitHint = document.getElementById('selectedUnitHint');
    const opt = mealSelect && mealSelect.options[mealSelect.selectedIndex];
    if (!opt || !opt.textContent) {
        if (unitLabel) unitLabel.textContent = '';
        if (unitHint) unitHint.textContent = '';
        return;
    }
    const meta = extractMealMetaFromOptionText(opt.textContent);
    if (unitLabel) unitLabel.textContent = meta.unitType ? `(${meta.unitType})` : '';
    if (unitHint) unitHint.textContent =
        meta.caloriesPerServing && meta.unitsPerServing && meta.unitType
            ? `${meta.caloriesPerServing} cal per ${meta.unitsPerServing} ${meta.unitType}`
            : '';
    updateLiveCalc();
}

function updateLiveCalc() {
    const mealSelect = document.getElementById('mealSelect');
    const ouncesInput = document.querySelector('#logMealForm input[name="ounces"]');
    const liveCalc = document.getElementById('liveCalc');
    const opt = mealSelect && mealSelect.options[mealSelect.selectedIndex];
    const qty = parseFloat(ouncesInput && ouncesInput.value || '0');
    if (!opt || !(qty > 0)) {
        if (liveCalc) liveCalc.textContent = '';
        return;
    }
    const meta = extractMealMetaFromOptionText(opt.textContent);
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

async function updateMealSelect(selectedId) {
    try {
        const res = await apiFetch('/api/meals');
        const data = await res.json();
        const select = document.getElementById('mealSelect');
        select.innerHTML = '';
        if (!data.meals || data.meals.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = 'No templates yet';
            opt.disabled = true;
            select.appendChild(opt);
            return;
        }
        data.meals.forEach(meal => {
            const option = document.createElement('option');
            option.value = meal.id;
            const unitType = meal.unit_type || 'piece';
            option.textContent = `${meal.name} (${meal.calories_per_serving} cal/${meal.ounces_per_serving} ${unitType})`;
            if (selectedId && meal.id === selectedId) option.selected = true;
            select.appendChild(option);
        });
        updateUnitUI();
    } catch (err) {
        console.error('Error loading meal select:', err);
    }
}

async function loadSavedMeals() {
    try {
        const res = await apiFetch('/api/meals');
        const data = await res.json();
        const container = document.getElementById('savedMeals');

        if (data.status === 'success' && data.meals && data.meals.length > 0) {
            const rows = data.meals.map(meal => {
                const unitType = meal.unit_type || 'piece';
                return `<tr class="hover:bg-gray-50">
                    <td class="border px-3 py-2 text-center text-gray-400 text-xs">${meal.id}</td>
                    <td class="border px-3 py-2 font-medium">${meal.name}</td>
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
    const mealSelect = document.getElementById('mealSelect');
    const selectedOption = mealSelect.options[mealSelect.selectedIndex];
    const units = parseFloat(form.ounces.value);

    if (!selectedOption || !units) {
        document.getElementById('logMealMsg').innerHTML = '<div class="msg-error text-sm">Please select a template and enter quantity</div>';
        return;
    }

    const mealName = selectedOption.textContent.split(' (')[0];
    const calMatch = selectedOption.textContent.match(/\((\d+(?:\.\d+)?) cal/);
    const unitMatch = selectedOption.textContent.match(/cal\/(\d+(?:\.\d+)?) /);
    const caloriesPerServing = calMatch ? parseFloat(calMatch[1]) : 0;
    const ouncesPerServing = unitMatch ? parseFloat(unitMatch[1]) : 1;
    const calories = Math.round((units * caloriesPerServing) / ouncesPerServing);

    try {
        const res = await apiPost('/api/meal_log', {
            meal_name: mealName,
            date: form.date.value,
            calories: calories
        });
        const data = await res.json();
        if (data.status === 'success') {
            form.reset();
            setTodayForLogDate();
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
            setTodayForLogDate();
            renderTodayMeals();
            document.getElementById('quickAddMsg').innerHTML = '<div class="msg-success text-sm">Quick add logged!</div>';
        } else {
            document.getElementById('quickAddMsg').innerHTML = `<div class="msg-error text-sm">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('quickAddMsg').innerHTML = `<div class="msg-error text-sm">${err.message}</div>`;
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

// AI calorie lookup
document.getElementById('lookupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const resultDiv = document.getElementById('lookupResult');
    resultDiv.innerHTML = `
        <div class="flex items-center justify-center p-4">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            <span class="ml-3 text-gray-500 text-sm">Looking up calories...</span>
        </div>`;

    try {
        const res = await apiPost('/api/lookup_calories', {
            foodName: form.foodName.value,
            portionSize: form.portionSize.value
        });
        const data = await res.json();

        if (data.status === 'success') {
            const result = data.data;
            resultDiv.innerHTML = `
                <div class="fade-in bg-green-50 border border-green-200 rounded-lg p-4">
                    <div class="grid grid-cols-3 gap-3 mb-3 text-center">
                        <div class="bg-white rounded-lg p-3 border">
                            <div class="text-xs text-gray-500">Calories</div>
                            <div class="text-xl font-bold text-green-600">${result.calories || 'N/A'}</div>
                        </div>
                        <div class="bg-white rounded-lg p-3 border">
                            <div class="text-xs text-gray-500">Serving (oz)</div>
                            <div class="text-xl font-bold text-green-600">${result.servingSizeOunces || 'N/A'}</div>
                        </div>
                        <div class="bg-white rounded-lg p-3 border">
                            <div class="text-xs text-gray-500">Cal/oz</div>
                            <div class="text-xl font-bold text-green-600">${result.calories && result.servingSizeOunces ? Math.round(result.calories / result.servingSizeOunces) : 'N/A'}</div>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg p-3 border mb-3">
                        <div class="text-xs text-gray-500 mb-1">AI Reasoning</div>
                        <div class="text-sm text-gray-700">${result.reasoning || 'No reasoning provided'}</div>
                    </div>
                    ${result.calories && result.servingSizeOunces ? `
                    <div class="flex gap-2">
                        <button onclick="populateAddMealForm('${form.foodName.value.replace(/'/g, "\\'")}', ${result.calories}, ${result.servingSizeOunces})"
                            class="flex-1 btn-primary text-sm py-1.5">Populate Form</button>
                        <button onclick="addLookupResult('${form.foodName.value.replace(/'/g, "\\'")}', ${result.calories}, ${result.servingSizeOunces})"
                            class="flex-1 btn-success text-sm py-1.5">Add to Templates</button>
                    </div>` : ''}
                </div>`;
        } else {
            resultDiv.innerHTML = `<div class="msg-error text-sm">${data.message}</div>`;
        }
    } catch (err) {
        resultDiv.innerHTML = `<div class="msg-error text-sm">${err.message}</div>`;
    }
});

function populateAddMealForm(name, calories, ounces) {
    const form = document.getElementById('addMealForm');
    form.name.value = name;
    form.calories_per_serving.value = calories;
    form.ounces_per_serving.value = ounces;
    form.scrollIntoView({ behavior: 'smooth' });
    document.getElementById('addMealMsg').innerHTML = '<div class="msg-info text-sm">Form populated. Review and click "Add Food Template" to save.</div>';
}

async function addLookupResult(name, calories, ounces) {
    try {
        const res = await apiPost('/api/meals', {
            name: name,
            calories_per_serving: calories,
            ounces_per_serving: ounces
        });
        const data = await res.json();
        if (data.status === 'success') {
            document.getElementById('addMealMsg').innerHTML = `<div class="msg-success text-sm">Added "${name}" from lookup result</div>`;
            updateMealSelect(data.meal_id);
            loadSavedMeals();
        } else {
            document.getElementById('addMealMsg').innerHTML = `<div class="msg-error text-sm">${data.message}</div>`;
        }
    } catch (err) {
        document.getElementById('addMealMsg').innerHTML = `<div class="msg-error text-sm">${err.message}</div>`;
    }
}

// ==============================================
//  TODAY'S FOOD LOG
// ==============================================

let currentViewDate = new Date();

async function renderTodayMeals() {
    const viewDate = getLocalDate(currentViewDate);

    try {
        const [mealRes, quickAddRes] = await Promise.all([
            apiFetch(`/api/meal_log_for_day?date=${viewDate}`),
            apiFetch(`/api/quick_add_for_day?date=${viewDate}`)
        ]);

        const mealData = await mealRes.json();
        const quickAddData = await quickAddRes.json();
        const container = document.getElementById('todayMeals');

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

function generateDayNavigation() {
    const today = new Date();
    const isToday = getLocalDate(currentViewDate) === getLocalDate(today);
    const nextDisabled = isToday;
    const dateLabel = formatDisplayDate(currentViewDate);

    return `
        <div class="flex items-center gap-2">
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

function goToPreviousDay() {
    currentViewDate.setDate(currentViewDate.getDate() - 1);
    renderTodayMeals();
}

function goToNextDay() {
    if (getLocalDate(currentViewDate) !== getLocalDate(new Date())) {
        currentViewDate.setDate(currentViewDate.getDate() + 1);
        renderTodayMeals();
    }
}

function goToToday() {
    currentViewDate = new Date();
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

            window.caloriesChart = new ApexCharts(chartEl, {
                series: [{ name: 'Daily Calories', data: calories, type: 'column' }],
                chart: { height: 280, type: 'bar', toolbar: { show: true } },
                colors: ['#7c3aed'],
                dataLabels: { enabled: true, formatter: v => Math.round(v), style: { fontSize: '10px', colors: ['#7c3aed'] } },
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
                Generated by Diet App &bull; Consult your healthcare provider for medical advice
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
        document.getElementById('weightLogDate')
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

    // Hook up unit UI events
    const mealSelect = document.getElementById('mealSelect');
    const ouncesInput = document.querySelector('#logMealForm input[name="ounces"]');
    if (mealSelect) mealSelect.addEventListener('change', updateUnitUI);
    if (ouncesInput) ouncesInput.addEventListener('input', updateLiveCalc);

    // Load data
    updateMealSelect();
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
