// Helper to fetch and update meal select
async function updateMealSelect(selectedId) {
  const res = await fetch('/api/meals');
  const data = await res.json();
  const select = document.getElementById('mealSelect');
  select.innerHTML = '';
  data.meals.forEach(meal => {
    const option = document.createElement('option');
    option.value = meal.id;
    option.textContent = `${meal.name} (${meal.calories_per_serving} cal/${meal.ounces_per_serving}oz) - ID: ${meal.id}`;
    if (selectedId && meal.id === selectedId) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

document.getElementById('addMealForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = {
    name: form.name.value,
    calories_per_serving: form.calories_per_serving.value,
    ounces_per_serving: form.ounces_per_serving.value
  };
  const res = await fetch('/api/meals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (data.status === 'success') {
    form.reset();
    updateMealSelect();
    loadSavedMeals();
    document.getElementById('addMealMsg').innerHTML = `
          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-green-800 font-medium">Meal added successfully!</span>
            </div>
          </div>
        `;
  } else {
    document.getElementById('addMealMsg').innerHTML = `
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-red-800 font-medium">Error adding meal: ${data.message}</span>
            </div>
          </div>
        `;
  }
});

document.getElementById('logMealForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;

  // Get the selected meal details to calculate calories
  const mealSelect = document.getElementById('mealSelect');
  const selectedOption = mealSelect.options[mealSelect.selectedIndex];
  const ounces = parseFloat(form.ounces.value);

  if (!selectedOption || !ounces) {
    document.getElementById('logMealMsg').innerHTML = `
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-red-800 font-medium">Please select a meal and enter ounces</span>
            </div>
          </div>
        `;
    return;
  }

  // Extract meal name and calculate calories
  const mealName = selectedOption.textContent.split(' (')[0];
  const caloriesPerServing = parseFloat(selectedOption.textContent.match(/\((\d+) cal/)[1]);
  const ouncesPerServing = parseFloat(selectedOption.textContent.match(/(\d+(?:\.\d+)?)oz\)/)[1]);
  const calories = Math.round((ounces * caloriesPerServing) / ouncesPerServing);

  const body = {
    meal_name: mealName,
    date: form.date.value,
    calories: calories
  };

  const res = await fetch('/api/meal_log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (data.status === 'success') {
    form.reset();
    document.getElementById('logMealMsg').innerHTML = `
          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-green-800 font-medium">Meal logged successfully!</span>
            </div>
          </div>
        `;
    setTodayForLogDate();
    renderTodayMeals();
  } else {
    document.getElementById('logMealMsg').innerHTML = `
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-red-800 font-medium">Error logging meal: ${data.message}</span>
            </div>
          </div>
        `;
  }
});

document.getElementById('lookupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const resultDiv = document.getElementById('lookupResult');
  resultDiv.innerHTML = `
      <div class="flex items-center justify-center p-6">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span class="ml-3 text-gray-600">Looking up calories...</span>
      </div>
    `;

  const body = {
    foodName: form.foodName.value,
    portionSize: form.portionSize.value
  };

  try {
    const res = await fetch('/api/lookup_calories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (data.status === 'success') {
      const result = data.data;
      resultDiv.innerHTML = `
        <div class="fade-in bg-green-50 border border-green-200 rounded-lg p-6">
          <div class="flex items-center mb-4">
            <div class="flex-shrink-0">
              <svg class="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-green-800">Calorie Lookup Successful!</h3>
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-white rounded-lg p-4 border border-green-200">
              <div class="text-sm font-medium text-gray-500">Estimated Calories</div>
              <div class="text-2xl font-bold text-green-600">${result.calories || 'N/A'}</div>
            </div>
            <div class="bg-white rounded-lg p-4 border border-green-200">
              <div class="text-sm font-medium text-gray-500">Serving Size</div>
              <div class="text-2xl font-bold text-green-600">${result.servingSizeOunces || 'N/A'} oz</div>
            </div>
            <div class="bg-white rounded-lg p-4 border border-green-200">
              <div class="text-sm font-medium text-gray-500">Calories per Oz</div>
              <div class="text-2xl font-bold text-green-600">${result.calories && result.servingSizeOunces ? Math.round(result.calories / result.servingSizeOunces) : 'N/A'}</div>
            </div>
          </div>
          
          <div class="bg-white rounded-lg p-4 border border-green-200 mb-6">
            <div class="text-sm font-medium text-gray-500 mb-2">AI Reasoning</div>
            <div class="text-gray-700 text-sm leading-relaxed">${result.reasoning || 'No reasoning provided'}</div>
          </div>
          
          ${result.calories && result.servingSizeOunces ?
          `<div class="flex gap-3">
              <button onclick="populateAddMealForm('${form.foodName.value}', ${result.calories}, ${result.servingSizeOunces})" 
                      class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                📝 Populate Add Meal Form
              </button>
              <button onclick="addLookupResult('${form.foodName.value}', ${result.calories}, ${result.servingSizeOunces})" 
                      class="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors">
                ➕ Add to Meals
              </button>
            </div>` :
          ''
        }
        </div>
      `;
    } else {
      // Check if it's a Cloudflare 403 error
      if (data.statusCode === 403 && data.message && data.message.includes('Cloudflare allowlist')) {
        resultDiv.innerHTML = `
          <div class="fade-in bg-red-50 border border-red-200 rounded-lg p-6">
            <div class="flex items-center mb-4">
              <div class="flex-shrink-0">
                <svg class="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-lg font-medium text-red-800">Cloudflare Proxy Error</h3>
              </div>
            </div>
            
            <div class="bg-white rounded-lg p-4 border border-red-200 mb-4">
              <div class="text-sm font-medium text-red-600 mb-2">Error Message</div>
              <div class="text-gray-700 mb-3">${data.message}</div>
              
              <div class="text-sm font-medium text-red-600 mb-2">Status Code</div>
              <div class="text-gray-700 mb-3">${data.statusCode}</div>
            </div>
            
            <button onclick="showCloudflareErrorModal()" 
                    class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
              🔍 View Full Error Page
            </button>
          </div>
        `;

        // Store the error details for the modal
        window.cloudflareErrorDetails = data;
      } else {
        resultDiv.innerHTML = `
          <div class="fade-in bg-red-50 border border-red-200 rounded-lg p-6">
            <div class="flex items-center mb-4">
              <div class="flex-shrink-0">
                <svg class="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-lg font-medium text-red-800">Error Details</h3>
              </div>
            </div>
            
            <div class="bg-white rounded-lg p-4 border border-red-200">
              <div class="text-sm font-medium text-red-600 mb-2">Error Message</div>
              <div class="text-gray-700 mb-3">${data.message}</div>
              
              <div class="text-sm font-medium text-red-600 mb-2">Status Code</div>
              <div class="text-gray-700 mb-3">${data.statusCode || 'Unknown'}</div>
              
              <div class="text-sm font-medium text-red-600 mb-2">Technical Details</div>
              <pre class="text-xs bg-gray-100 p-2 rounded overflow-x-auto">${JSON.stringify(data.details, null, 2)}</pre>
            </div>
          </div>
        `;
      }
    }
  } catch (error) {
    resultDiv.innerHTML = `
          <div class="fade-in bg-red-50 border border-red-200 rounded-lg p-6">
            <div class="flex items-center">
              <svg class="h-8 w-8 text-red-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-red-800 font-medium">Network Error: ${error.message}</span>
            </div>
          </div>
        `;
  }
});

function populateAddMealForm(name, calories, ounces) {
  const addMealForm = document.getElementById('addMealForm');
  addMealForm.name.value = name;
  addMealForm.calories_per_serving.value = calories;
  addMealForm.ounces_per_serving.value = ounces;

  // Scroll to the add meal form
  addMealForm.scrollIntoView({ behavior: 'smooth' });

  // Show a message
  document.getElementById('addMealMsg').innerHTML = `
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div class="flex items-center">
          <svg class="h-5 w-5 text-blue-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-blue-800 font-medium">Form populated with ${name} data. Review and click "Add Meal" to save.</span>
        </div>
      </div>
    `;
}

// Helper function to get today's date in local timezone
function getTodayLocalDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to get a date in local timezone
function getLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function setTodayForLogDate() {
  const logDateInput = document.getElementById('logDate');
  const quickAddDateInput = document.getElementById('quickAddDate');
  if (logDateInput) {
    logDateInput.value = getTodayLocalDate();
  }
  if (quickAddDateInput) {
    quickAddDateInput.value = getTodayLocalDate();
  }
}

async function addLookupResult(name, calories, ounces) {
  const body = {
    name: name,
    calories_per_serving: calories,
    ounces_per_serving: ounces
  };

  const res = await fetch('/api/meals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();

  if (data.status === 'success') {
    document.getElementById('addMealMsg').innerHTML = `
          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-green-800 font-medium">Added ${name} from lookup result</span>
            </div>
          </div>
        `;
    // Select the new meal in the dropdown
    updateMealSelect(data.meal_id);
    renderTodayMeals();
  } else {
    document.getElementById('addMealMsg').innerHTML = `
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-red-800 font-medium">Error adding meal: ${data.message}</span>
            </div>
          </div>
        `;
  }
}

// Quick Add form handler
document.getElementById('quickAddForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = {
    name: form.name.value,
    calories: form.calories.value,
    date: form.date.value
  };
  const res = await fetch('/api/quick_add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (data.status === 'success') {
    form.reset();
    setTodayForLogDate();
    document.getElementById('quickAddMsg').innerHTML = `
          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-green-800 font-medium">Quick add logged successfully!</span>
            </div>
          </div>
        `;
    renderTodayMeals();
  } else {
    document.getElementById('quickAddMsg').innerHTML = `
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-red-800 font-medium">Error logging quick add: ${data.message}</span>
            </div>
          </div>
        `;
  }
});

// Day navigation state
let currentViewDate = new Date();
let dailyMealsData = [];

async function renderTodayMeals() {
  const viewDate = getLocalDate(currentViewDate);

  // Fetch both regular meals and quick add items for the selected date
  const [mealRes, quickAddRes] = await Promise.all([
    fetch(`/api/meal_log_for_day?date=${viewDate}`),
    fetch(`/api/quick_add_for_day?date=${viewDate}`)
  ]);

  const mealData = await mealRes.json();
  const quickAddData = await quickAddRes.json();

  const container = document.getElementById('todayMeals');

  // Check if we have any data
  const hasMeals = mealData.logs && mealData.logs.length > 0;
  const hasQuickAdds = quickAddData.logs && quickAddData.logs.length > 0;

  if (!hasMeals && !hasQuickAdds) {
    container.innerHTML = `
      <div class="text-gray-500 text-center py-4">
        No food logged for ${formatDisplayDate(currentViewDate)} yet.
      </div>
      ${generateDayNavigation()}
    `;
    return;
  }

  // Combine and prepare all data
  dailyMealsData = [];

  // Process regular meals
  if (hasMeals) {
    mealData.logs.forEach(log => {
      dailyMealsData.push({
        ...log,
        type: 'meal',
        displayName: `🍽️ ${log.meal_name}`,
        colorClass: 'text-blue-600'
      });
    });
  }

  // Process quick add items
  if (hasQuickAdds) {
    quickAddData.logs.forEach(log => {
      dailyMealsData.push({
        ...log,
        type: 'quick_add',
        displayName: `⚡ ${log.name}`,
        colorClass: 'text-yellow-600'
      });
    });
  }

  renderMealsForDay();
}

function renderMealsForDay() {
  const container = document.getElementById('todayMeals');
  const totalItems = dailyMealsData.length;

  // Calculate total calories
  const totalCalories = dailyMealsData.reduce((sum, item) => sum + item.calories, 0);

  // Generate table rows for all items
  const mealRows = dailyMealsData.map(item => {
    const deleteFunction = item.type === 'meal' ? `deleteMealLog(${item.id})` : `deleteQuickAdd(${item.id})`;
    const deleteText = item.type === 'meal' ? 'delete this meal entry' : 'delete this quick add entry';

    return `<tr class='hover:bg-gray-50'>
      <td class='border border-gray-300 px-4 py-2'>${item.displayName}</td>
      <td class='border border-gray-300 px-4 py-2 ${item.colorClass} font-semibold'>${Math.round(item.calories)}</td>
      <td class='border border-gray-300 px-4 py-2 text-center'>
        <button onclick="${deleteFunction}" class="text-red-600 hover:text-red-800 transition-colors" title="${deleteText}">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full border-collapse mb-2">
        <thead>
          <tr class="bg-gray-100">
            <th class="border border-gray-300 px-4 py-2 text-left font-semibold">Food Item</th>
            <th class="border border-gray-300 px-4 py-2 text-left font-semibold">Calories</th>
            <th class="border border-gray-300 px-4 py-2 text-center font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>${mealRows}</tbody>
      </table>
      <div class="flex justify-between items-center">
        <div class="text-lg font-bold text-green-700">Total: ${Math.round(totalCalories)} cal</div>
        ${generateDayNavigation()}
      </div>
    </div>
  `;
}

function generateDayNavigation() {
  const today = new Date();
  const isToday = getLocalDate(currentViewDate) === getLocalDate(today);
  const isYesterday = getLocalDate(currentViewDate) === getLocalDate(new Date(today.getTime() - 24 * 60 * 60 * 1000));

  const prevDisabled = false; // Allow going back as far as needed
  const nextDisabled = isToday; // Can't go beyond today

  const prevClass = 'text-blue-600 hover:text-blue-800 cursor-pointer';
  const nextClass = nextDisabled ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 cursor-pointer';

  const dateLabel = isToday ? 'Today' : isYesterday ? 'Yesterday' : formatDisplayDate(currentViewDate);

  return `
    <div class="flex items-center space-x-4">
      <div class="flex items-center space-x-2">
        <button onclick="goToPreviousDay()" 
          class="p-2 rounded ${prevClass} transition-colors" title="Previous day">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span class="text-lg font-semibold text-gray-800 px-4">${dateLabel}</span>
        <button onclick="goToNextDay()" ${nextDisabled}
          class="p-2 rounded ${nextClass} transition-colors" title="Next day">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <button onclick="goToToday()" 
        class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm">
        Today
      </button>
    </div>
  `;
}

function formatDisplayDate(date) {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  if (getLocalDate(date) === getLocalDate(today)) {
    return 'Today';
  } else if (getLocalDate(date) === getLocalDate(yesterday)) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }
}

function goToPreviousDay() {
  currentViewDate.setDate(currentViewDate.getDate() - 1);
  renderTodayMeals();
}

function goToNextDay() {
  const today = new Date();
  if (getLocalDate(currentViewDate) !== getLocalDate(today)) {
    currentViewDate.setDate(currentViewDate.getDate() + 1);
    renderTodayMeals();
  }
}

function goToToday() {
  currentViewDate = new Date();
  renderTodayMeals();
}

async function loadCalendar() {
  const start = document.getElementById('calendarStart').value;
  const end = document.getElementById('calendarEnd').value;
  if (!start || !end) return;
  const res = await fetch(`/api/calories_range?start=${start}&end=${end}`);
  const data = await res.json();
  const tbody = document.querySelector('#calendarTable tbody');
  tbody.innerHTML = '';
  if (data.data.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="2" class="text-center py-4 text-gray-500">No data for selected date range</td>';
    tbody.appendChild(tr);
    return;
  }
  data.data.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';
    tr.innerHTML = `
          <td class="border border-gray-300 px-4 py-2">${row.date}</td>
          <td class="border border-gray-300 px-4 py-2 font-semibold text-blue-600">${Math.round(row.total_calories)} cal</td>
        `;
    tbody.appendChild(tr);
  });
}

document.getElementById('loadCalendar').addEventListener('click', loadCalendar);

// Blood Pressure form handler
document.getElementById('bloodPressureForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = {
    systolic: parseInt(form.systolic.value),
    diastolic: parseInt(form.diastolic.value)
  };

  const res = await fetch('/api/blood_pressure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();

  if (data.status === 'success') {
    form.reset();
    document.getElementById('bloodPressureMsg').innerHTML = `
          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-green-800 font-medium">Blood pressure logged successfully!</span>
            </div>
          </div>
        `;
    loadLatestBPReading();
  } else {
    document.getElementById('bloodPressureMsg').innerHTML = `
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-red-800 font-medium">Error logging blood pressure: ${data.message}</span>
            </div>
          </div>
        `;
  }
});

// Delete meal log entry
async function deleteMealLog(id) {
  if (!confirm('Are you sure you want to delete this meal entry?')) {
    return;
  }

  try {
    const res = await fetch(`/api/meal_log/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();

    if (data.status === 'success') {
      renderTodayMeals();
    } else {
      alert('Error deleting meal entry: ' + data.message);
    }
  } catch (error) {
    alert('Error deleting meal entry: ' + error.message);
  }
}

// Delete quick add entry
async function deleteQuickAdd(id) {
  if (!confirm('Are you sure you want to delete this quick add entry?')) {
    return;
  }

  try {
    const res = await fetch(`/api/quick_add/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();

    if (data.status === 'success') {
      renderTodayMeals();
    } else {
      alert('Error deleting quick add entry: ' + data.message);
    }
  } catch (error) {
    alert('Error deleting quick add entry: ' + error.message);
  }
}

// Load and display saved meal templates
async function loadSavedMeals() {
  try {
    const res = await fetch('/api/meals');
    const data = await res.json();
    const container = document.getElementById('savedMeals');

    if (data.status === 'success' && data.meals && data.meals.length > 0) {
      const rows = data.meals.map(meal => {
        return `<tr class='hover:bg-gray-50'>
          <td class='border border-gray-300 px-4 py-2 font-medium'>${meal.name} (ID: ${meal.id})</td>
          <td class='border border-gray-300 px-4 py-2 text-center'>${meal.calories_per_serving}</td>
          <td class='border border-gray-300 px-4 py-2 text-center'>${meal.ounces_per_serving}</td>
          <td class='border border-gray-300 px-4 py-2 text-center'>
            <button onclick="deleteMealTemplate(${meal.id}, '${meal.name}')" class="text-red-600 hover:text-red-800 transition-colors">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </td>
        </tr>`;
      }).join('');

      container.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full border-collapse mb-2">
            <thead>
              <tr class="bg-gray-100">
                <th class="border border-gray-300 px-4 py-2 text-left font-semibold">Meal Name</th>
                <th class="border border-gray-300 px-4 py-2 text-center font-semibold">Calories per Serving</th>
                <th class="border border-gray-300 px-4 py-2 text-center font-semibold">Ounces per Serving</th>
                <th class="border border-gray-300 px-4 py-2 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    } else {
      container.innerHTML = '<div class="text-gray-500 text-center py-4">No saved meal templates yet.</div>';
    }
  } catch (error) {
    document.getElementById('savedMeals').innerHTML = '<div class="text-red-500 text-center py-4">Error loading saved meals</div>';
  }
}

// Delete meal template
async function deleteMealTemplate(id, name) {
  if (!confirm(`Are you sure you want to delete the meal template "${name}"?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/meals/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();

    if (data.status === 'success') {
      loadSavedMeals();
      updateMealSelect();
      alert('Success! ' + data.message);
    } else {
      alert('Error deleting meal template: ' + data.message);
    }
  } catch (error) {
    alert('Error deleting meal template: ' + error.message);
  }
}

// Load and display the latest blood pressure reading
async function loadLatestBPReading() {
  try {
    const res = await fetch('/api/blood_pressure_latest');
    const data = await res.json();
    const container = document.getElementById('latestBPReading');

    if (data.status === 'success' && data.reading) {
      const reading = data.reading;
      const timestamp = new Date(reading.timestamp);
      const formattedTime = timestamp.toLocaleString();

      // Determine BP category and color
      let category, color;
      if (reading.systolic < 120 && reading.diastolic < 80) {
        category = 'Normal';
        color = 'text-green-600';
      } else if (reading.systolic < 130 && reading.diastolic < 80) {
        category = 'Elevated';
        color = 'text-yellow-600';
      } else if (reading.systolic < 140 || reading.diastolic < 90) {
        category = 'High (Stage 1)';
        color = 'text-orange-600';
      } else {
        category = 'High (Stage 2)';
        color = 'text-red-600';
      }

      container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div class="text-center">
            <div class="text-3xl font-bold text-red-600">${reading.systolic}</div>
            <div class="text-sm text-gray-500">Systolic</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-red-600">${reading.diastolic}</div>
            <div class="text-sm text-gray-500">Diastolic</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-semibold ${color}">${category}</div>
            <div class="text-xs text-gray-500">${formattedTime}</div>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = '<div class="text-gray-500">No readings yet</div>';
    }
  } catch (error) {
    document.getElementById('latestBPReading').innerHTML = '<div class="text-red-500">Error loading reading</div>';
  }
}

// --- Weight Log Section ---

// Log weight form handler
const weightForm = document.getElementById('weightLogForm');
if (weightForm) {
  weightForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const weight = parseFloat(form.weight.value);
    const date = form.date.value;
    if (!weight || weight < 50 || weight > 1000) {
      document.getElementById('weightLogMsg').innerHTML = `<div class="text-red-600">Please enter a valid weight (50-1000 lbs)</div>`;
      return;
    }
    const res = await fetch('/api/weight_log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight, date })
    });
    const data = await res.json();
    if (data.status === 'success') {
      document.getElementById('weightLogMsg').innerHTML = `<div class="text-green-700">Weight logged!</div>`;
      loadTodayWeight();
      loadRecentWeights();
    } else {
      document.getElementById('weightLogMsg').innerHTML = `<div class="text-red-600">${data.message}</div>`;
    }
  });
}

// Load today's weight
async function loadTodayWeight() {
  const today = getTodayLocalDate();
  const res = await fetch(`/api/weight_log_for_day?date=${today}`);
  const data = await res.json();
  const el = document.getElementById('todayWeight');
  if (data.status === 'success' && data.weight) {
    el.innerHTML = `<span class="font-bold text-lg">${data.weight} lbs</span>`;
  } else {
    el.innerHTML = `<span class="text-gray-500">No weight logged for today</span>`;
  }
}

// Load recent weights (last 7 days)
async function loadRecentWeights() {
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 6);
  const start = getLocalDate(weekAgo);
  const end = getLocalDate(today);
  const res = await fetch(`/api/weight_log_range?start=${start}&end=${end}`);
  const data = await res.json();
  const tbody = document.getElementById('recentWeightsTbody');
  if (data.status === 'success' && data.weights.length > 0) {
    tbody.innerHTML = data.weights.map(w => `<tr><td class='border px-2 py-1'>${w.date}</td><td class='border px-2 py-1'>${w.weight} lbs</td></tr>`).join('');
  } else {
    tbody.innerHTML = `<tr><td colspan='2' class='text-gray-500 text-center'>No recent weights</td></tr>`;
  }
}

// Cloudflare Error Modal Functions
function showCloudflareErrorModal() {
  // Create modal if it doesn't exist
  if (!document.getElementById('cloudflareModal')) {
    const modal = document.createElement('div');
    modal.id = 'cloudflareModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between p-4 border-b">
          <h3 class="text-lg font-semibold text-gray-800">Cloudflare Error Page</h3>
          <button onclick="closeCloudflareErrorModal()" class="text-gray-400 hover:text-gray-600">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="flex-1 p-4 overflow-hidden">
          <iframe id="cloudflareIframe" 
                  src="https://ollama.nicktantillo.com/api/generate" 
                  class="w-full h-full border rounded"
                  sandbox="allow-same-origin allow-scripts">
          </iframe>
        </div>
        <div class="p-4 border-t bg-gray-50">
          <p class="text-sm text-gray-600 mb-2">
            <strong>Instructions:</strong> Look for an IPv6 address in the error page above, then add it to your Cloudflare allowlist.
          </p>
          <div class="flex gap-2">
            <button onclick="closeCloudflareErrorModal()" 
                    class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
              Close
            </button>
            <button onclick="retryLookup()" 
                    class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Retry Lookup
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Show the modal
  document.getElementById('cloudflareModal').style.display = 'flex';
}

function closeCloudflareErrorModal() {
  const modal = document.getElementById('cloudflareModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function retryLookup() {
  closeCloudflareErrorModal();
  // Trigger the lookup form submission again
  document.getElementById('lookupForm').dispatchEvent(new Event('submit'));
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('cloudflareModal');
  if (modal && e.target === modal) {
    closeCloudflareErrorModal();
  }
});

// Timer to check for midnight crossing
let midnightCheckTimer = null;

// Function to check if we've crossed midnight and update dates if needed
function checkMidnightCrossing() {
  const now = new Date();
  const currentDate = getLocalDate(now);

  // Check if any date inputs need updating
  const dateInputs = [
    document.getElementById('logDate'),
    document.getElementById('quickAddDate'),
    document.getElementById('weightLogDate')
  ].filter(el => el); // Filter out null elements

  let needsUpdate = false;

  dateInputs.forEach(input => {
    if (input.value !== currentDate) {
      input.value = currentDate;
      needsUpdate = true;
    }
  });

  // If dates were updated, refresh the daily meals display
  if (needsUpdate) {
    renderTodayMeals();
    loadTodayWeight();
    loadRecentWeights();
  }
}

// Function to start the midnight checking timer
function startMidnightCheckTimer() {
  // Clear any existing timer
  if (midnightCheckTimer) {
    clearInterval(midnightCheckTimer);
  }

  // Check every minute for midnight crossing
  midnightCheckTimer = setInterval(checkMidnightCrossing, 60000);

  // Also check immediately in case the page was loaded after midnight
  checkMidnightCrossing();
}

// Function to stop the midnight checking timer
function stopMidnightCheckTimer() {
  if (midnightCheckTimer) {
    clearInterval(midnightCheckTimer);
    midnightCheckTimer = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateMealSelect();
  setTodayForLogDate();
  renderTodayMeals();
  loadSavedMeals();
  loadLatestBPReading();
  // Set default dates for calendar
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 6);
  document.getElementById('calendarEnd').value = getLocalDate(today);
  document.getElementById('calendarStart').value = getLocalDate(weekAgo);
  if (document.getElementById('weightLogForm')) {
    // Set today as default date
    document.getElementById('weightLogDate').value = getTodayLocalDate();
    loadTodayWeight();
    loadRecentWeights();
  }

  // Start the midnight checking timer
  startMidnightCheckTimer();
});

// Clean up timer when page is unloaded
window.addEventListener('beforeunload', () => {
  stopMidnightCheckTimer();
}); 