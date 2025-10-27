// Helper to fetch and update meal select
async function updateMealSelect(selectedId) {
  const res = await fetch('/api/meals');
  const data = await res.json();
  const select = document.getElementById('mealSelect');
  select.innerHTML = '';
  data.meals.forEach(meal => {
    const option = document.createElement('option');
    option.value = meal.id;
    const unitType = meal.unit_type || 'piece';
    option.textContent = `${meal.name} (${meal.calories_per_serving} cal/${meal.ounces_per_serving} ${unitType}) - ID: ${meal.id}`;
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
    ounces_per_serving: form.ounces_per_serving.value,
    unit_type: form.unit_type.value
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
              <span class="text-green-800 font-medium">Food metric added successfully!</span>
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
              <span class="text-red-800 font-medium">Error adding food metric: ${data.message}</span>
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
  const units = parseFloat(form.ounces.value);

  if (!selectedOption || !units) {
    document.getElementById('logMealMsg').innerHTML = `
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-red-800 font-medium">Please select a food metric and enter quantity</span>
            </div>
          </div>
        `;
    return;
  }

  // Extract meal name and calculate calories
  const mealName = selectedOption.textContent.split(' (')[0];
  const caloriesPerServing = parseFloat(selectedOption.textContent.match(/\((\d+(?:\.\d+)?) cal/)[1]);
  const ouncesPerServing = parseFloat(selectedOption.textContent.match(/cal\/(\d+(?:\.\d+)?) /)[1]);
  const calories = Math.round((units * caloriesPerServing) / ouncesPerServing);

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
              <span class="text-green-800 font-medium">Food metric logged successfully!</span>
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
              <span class="text-red-800 font-medium">Error logging food metric: ${data.message}</span>
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

// Helper function to convert UTC timestamp to local date string
function getLocalDateFromUTC(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to expand date range for timezone differences
function getExpandedDateRange(startDate, endDate) {
  // Expand the date range by one day on each end to ensure we capture
  // readings that might be in different timezones
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setDate(start.getDate() - 1);
  end.setDate(end.getDate() + 1);

  return {
    start: getLocalDate(start),
    end: getLocalDate(end)
  };
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
        const unitType = meal.unit_type || 'piece';
        return `<tr class='hover:bg-gray-50'>
          <td class='border border-gray-300 px-4 py-2 font-medium'>${meal.name} (ID: ${meal.id})</td>
          <td class='border border-gray-300 px-4 py-2 text-center'>${meal.calories_per_serving}</td>
          <td class='border border-gray-300 px-4 py-2 text-center'>${meal.ounces_per_serving} ${unitType}</td>
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
                <th class="border border-gray-300 px-4 py-2 text-left font-semibold">Food Metric Name</th>
                <th class="border border-gray-300 px-4 py-2 text-center font-semibold">Calories per Unit</th>
                <th class="border border-gray-300 px-4 py-2 text-center font-semibold">Units per Serving</th>
                <th class="border border-gray-300 px-4 py-2 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    } else {
      container.innerHTML = '<div class="text-gray-500 text-center py-4">No saved food metric templates yet.</div>';
    }
  } catch (error) {
    document.getElementById('savedMeals').innerHTML = '<div class="text-red-500 text-center py-4">Error loading saved food metrics</div>';
  }
}

// Delete meal template
async function deleteMealTemplate(id, name) {
  if (!confirm(`Are you sure you want to delete the food metric template "${name}"?`)) {
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
      alert('Error deleting food metric template: ' + data.message);
    }
  } catch (error) {
    alert('Error deleting food metric template: ' + error.message);
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
      loadWeightChart();
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

// Weight pagination state
let currentWeightWeek = 0; // 0 = current week, -1 = previous week, etc.

// Load recent weights with pagination (2 weeks)
async function loadRecentWeights() {
  // Show all weight entries instead of paginated 2-week periods
  const res = await fetch('/api/weight_log_all');
  const data = await res.json();
  const tbody = document.getElementById('recentWeightsTbody');

  if (data.status === 'success' && data.weights && data.weights.length > 0) {
    tbody.innerHTML = data.weights.map(w => `<tr><td class='border px-2 py-1'>${w.date}</td><td class='border px-2 py-1'>${w.weight} lbs</td></tr>`).join('');
  } else {
    tbody.innerHTML = `<tr><td colspan='2' class='text-gray-500 text-center'>No weight entries found</td></tr>`;
  }

  // Update label to show total count
  updateWeightWeekLabel();
}

async function updateWeightWeekLabel() {
  // Get total count of weight entries
  const res = await fetch('/api/weight_log_all');
  const data = await res.json();
  const label = document.getElementById('weightWeekLabel');

  if (data.status === 'success' && data.weights && data.weights.length > 0) {
    label.textContent = `All Weight Entries (${data.weights.length} total)`;
  } else {
    label.textContent = 'All Weight Entries (0 total)';
  }
}

// Weight navigation functions (disabled since we show all entries)
function goToPreviousWeightWeek() {
  // No-op since we show all entries
}

function goToNextWeightWeek() {
  // No-op since we show all entries
}

// Load weight chart with trend line, blood pressure, and calories
async function loadWeightChart() {
  try {
    console.log('Starting weight chart load...');
    if (typeof ApexCharts === 'undefined') {
      console.error('ApexCharts not loaded, trying fallback...');
      showSimpleWeightChart();
      return;
    }
    if (typeof ApexCharts !== 'function') {
      console.error('ApexCharts is not a constructor, trying fallback...');
      showSimpleWeightChart();
      return;
    }
    console.log('ApexCharts loaded successfully');
    const res = await fetch('/api/weight_log_all');
    console.log('API response received');
    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    console.log('Data parsed:', data);
    if (data.status === 'success' && data.weights && data.weights.length > 0) {
      const chartElement = document.getElementById('weightChart');
      if (!chartElement) {
        console.error('Weight chart element not found');
        return;
      }
      console.log('Creating ApexCharts with', data.weights.length, 'data points');
      // Clear existing content
      chartElement.innerHTML = '';
      // Destroy existing chart if it exists
      if (window.weightChart && typeof window.weightChart.destroy === 'function') {
        window.weightChart.destroy();
      }
      const weights = data.weights;
      // Sort weights by date to guarantee consistent ordering
      const sortedWeights = [...weights].sort((a, b) => new Date(a.date) - new Date(b.date));
      // Build time-series points so x-axis accounts for missed days
      const points = sortedWeights
        .map(w => ({ x: new Date(w.date + 'T00:00:00').getTime(), y: w.weight }));
      // Calculate trend line values aligned to existing points
      const trendLineValues = calculateTrendLine(sortedWeights);
      const trendPoints = points.map((p, i) => ({ x: p.x, y: trendLineValues[i] }));
      const options = {
        series: [
          {
            name: 'Weight',
            data: points,
            type: 'line'
          },
          {
            name: 'Trend Line',
            data: trendPoints,
            type: 'line'
          }
        ],
        chart: {
          height: 300,
          type: 'line',
          animations: { enabled: false },
          zoom: {
            enabled: true
          },
          toolbar: {
            show: true,
            tools: {
              download: true,
              selection: true,
              zoom: true,
              zoomin: true,
              zoomout: true,
              pan: true,
              reset: true
            }
          }
        },
        colors: ['#3B82F6', '#EF4444'],
        dataLabels: {
          enabled: false
        },
        stroke: {
          curve: 'straight',
          width: [4, 3],
          dashArray: [0, 5]
        },
        fill: {
          type: 'solid',
          opacity: 0.8
        },
        markers: {
          size: 4,
          colors: ['#3B82F6'],
          strokeColors: '#fff',
          strokeWidth: 2,
          hover: {
            size: 6
          }
        },
        xaxis: {
          type: 'datetime',
          title: {
            text: 'Date'
          }
        },
        yaxis: {
          title: {
            text: 'Weight (lbs)'
          },
          labels: {
            formatter: function (value) {
              return value + ' lbs';
            }
          }
        },
        tooltip: {
          y: {
            formatter: function (value) {
              return value + ' lbs';
            }
          }
        },
        legend: {
          position: 'top'
        },
        grid: {
          borderColor: '#e7e7e7',
          row: {
            colors: ['#f3f3f3', 'transparent'],
            opacity: 0.5
          }
        }
      };
      try {
        window.weightChart = new ApexCharts(chartElement, options);
        window.weightChart.render();
        console.log('ApexCharts rendered successfully');
      } catch (chartError) {
        console.error('Error creating ApexCharts:', chartError);
        showSimpleWeightChart();
      }
    } else {
      console.log('No weight data available');
      showNoDataMessage();
    }
  } catch (error) {
    console.error('Error loading weight chart:', error);
    showErrorMessage(error.message);
  }
}

// Fallback simple chart using HTML/CSS
function showSimpleWeightChart() {
  try {
    const chartElement = document.getElementById('weightChart');
    if (!chartElement) return;

    fetch('/api/weight_log_all')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success' && data.weights && data.weights.length > 0) {
          const weights = data.weights;
          const maxWeight = Math.max(...weights.map(w => w.weight));
          const minWeight = Math.min(...weights.map(w => w.weight));
          const range = maxWeight - minWeight;

          const chartHTML = `
            <div class="bg-white p-4 rounded-lg border">
              <h4 class="text-lg font-semibold mb-4">Weight Trend (Simple View)</h4>
              <div class="space-y-3">
                ${weights.map((weight, index) => {
            const height = range > 0 ? ((weight.weight - minWeight) / range) * 200 + 20 : 20;
            return `
                    <div class="flex items-center space-x-2">
                      <span class="text-sm text-gray-600 w-20">${weight.date}</span>
                      <div class="flex-1 bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full" style="width: ${(weight.weight - minWeight) / range * 100}%"></div>
                      </div>
                      <span class="text-sm font-medium w-16">${weight.weight} lbs</span>
                    </div>
                  `;
          }).join('')}
              </div>
            </div>
          `;

          chartElement.innerHTML = chartHTML;
        } else {
          showNoDataMessage();
        }
      })
      .catch(error => {
        console.error('Error in simple chart:', error);
        showErrorMessage(error.message);
      });
  } catch (error) {
    console.error('Error in showSimpleWeightChart:', error);
    showErrorMessage(error.message);
  }
}

function showNoDataMessage() {
  const chartElement = document.getElementById('weightChart');
  if (chartElement) {
    chartElement.innerHTML = `
      <div class="flex items-center justify-center h-64 text-gray-500">
        <div class="text-center">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p class="mt-2 text-sm">No weight data available</p>
          <p class="text-xs text-gray-400 mt-1">Add some weight entries to see your trend</p>
        </div>
      </div>
    `;
  }
}

function showErrorMessage(errorMsg) {
  const chartElement = document.getElementById('weightChart');
  if (chartElement) {
    chartElement.innerHTML = `
      <div class="flex items-center justify-center h-64 text-red-500">
        <div class="text-center">
          <svg class="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="mt-2 text-sm">Error loading chart</p>
          <p class="text-xs text-red-400 mt-1">${errorMsg}</p>
        </div>
      </div>
    `;
  }
}

// Calculate trend line using linear regression
function calculateTrendLine(weights) {
  if (weights.length < 2) return weights.map(w => w.weight);

  const n = weights.length;
  const xValues = Array.from({ length: n }, (_, i) => i);
  const yValues = weights.map(w => w.weight);

  // Calculate means
  const xMean = xValues.reduce((a, b) => a + b, 0) / n;
  const yMean = yValues.reduce((a, b) => a + b, 0) / n;

  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
    denominator += (xValues[i] - xMean) ** 2;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  // Generate trend line points
  return xValues.map(x => slope * x + intercept);
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

// Load blood pressure chart
async function loadBloodPressureChart() {
  try {
    console.log('Starting blood pressure chart load...');
    if (typeof ApexCharts === 'undefined') {
      console.error('ApexCharts not loaded for BP chart');
      return;
    }

    console.log('Fetching from /api/blood_pressure_all...');
    const res = await fetch('/api/blood_pressure_all');
    console.log('Response status:', res.status, res.statusText);

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log('BP data parsed:', data);
    console.log('Data status:', data.status);
    console.log('Readings length:', data.readings ? data.readings.length : 'undefined');
    if (data.readings && data.readings.length > 0) {
      console.log('First reading:', data.readings[0]);
    }

    if (data.status === 'success' && data.readings && data.readings.length > 0) {
      const chartElement = document.getElementById('bloodPressureChart');
      if (!chartElement) {
        console.error('Blood pressure chart element not found');
        return;
      }

      // Clear existing content
      chartElement.innerHTML = '';

      // Destroy existing chart if it exists
      if (window.bpChart && typeof window.bpChart.destroy === 'function') {
        window.bpChart.destroy();
      }

      const readings = data.readings;
      console.log('Processing readings:', readings);

      const dates = readings.map(r => {
        const date = new Date(r.timestamp);
        const formattedDate = date.toLocaleDateString();
        console.log('Converting timestamp:', r.timestamp, 'to date:', formattedDate);
        return formattedDate;
      });
      const systolic = readings.map(r => r.systolic);
      const diastolic = readings.map(r => r.diastolic);

      console.log('Processed dates:', dates);
      console.log('Processed systolic:', systolic);
      console.log('Processed diastolic:', diastolic);

      const options = {
        series: [
          {
            name: 'Systolic',
            data: systolic,
            type: 'line'
          },
          {
            name: 'Diastolic',
            data: diastolic,
            type: 'line'
          }
        ],
        chart: {
          height: 300,
          type: 'line',
          zoom: {
            enabled: true
          },
          toolbar: {
            show: true,
            tools: {
              download: true,
              selection: true,
              zoom: true,
              zoomin: true,
              zoomout: true,
              pan: true,
              reset: true
            }
          }
        },
        colors: ['#EF4444', '#3B82F6'],
        dataLabels: {
          enabled: false
        },
        stroke: {
          curve: 'smooth',
          width: [3, 3]
        },
        fill: {
          type: 'solid',
          opacity: 0.8
        },
        markers: {
          size: 4,
          colors: ['#EF4444', '#3B82F6'],
          strokeColors: '#fff',
          strokeWidth: 2,
          hover: {
            size: 6
          }
        },
        xaxis: {
          categories: dates,
          title: {
            text: 'Date'
          }
        },
        yaxis: {
          title: {
            text: 'Blood Pressure (mmHg)'
          },
          labels: {
            formatter: function (value) {
              return value + ' mmHg';
            }
          },
          min: 0,
          max: 200
        },
        tooltip: {
          y: {
            formatter: function (value) {
              return value + ' mmHg';
            }
          }
        },
        legend: {
          position: 'top'
        },
        grid: {
          borderColor: '#e7e7e7',
          row: {
            colors: ['#f3f3f3', 'transparent'],
            opacity: 0.5
          }
        }
      };

      try {
        console.log('Creating ApexCharts with options:', options);
        window.bpChart = new ApexCharts(chartElement, options);
        console.log('Chart object created, rendering...');
        window.bpChart.render();
        console.log('Blood pressure chart rendered successfully');
      } catch (chartError) {
        console.error('Error creating blood pressure chart:', chartError);
        chartElement.innerHTML = '<div class="text-red-500 text-center py-4">Error creating blood pressure chart</div>';
      }
    } else {
      const chartElement = document.getElementById('bloodPressureChart');
      if (chartElement) {
        chartElement.innerHTML = `
          <div class="flex items-center justify-center h-64 text-gray-500">
            <div class="text-center">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p class="mt-2 text-sm">No blood pressure data available</p>
              <p class="text-xs text-gray-400 mt-1">Add some blood pressure readings to see your trend</p>
            </div>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Error loading blood pressure chart:', error);
    const chartElement = document.getElementById('bloodPressureChart');
    if (chartElement) {
      chartElement.innerHTML = `
        <div class="flex items-center justify-center h-64 text-red-500">
          <div class="text-center">
            <svg class="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="mt-2 text-sm">Error loading blood pressure chart</p>
            <p class="text-xs text-red-400 mt-1">${error.message}</p>
          </div>
        </div>
      `;
    }
  }
}

// Load calories chart
async function loadCaloriesChart() {
  try {
    console.log('Starting calories chart load...');
    if (typeof ApexCharts === 'undefined') {
      console.error('ApexCharts not loaded for calories chart');
      return;
    }

    const res = await fetch('/api/calories_all');
    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log('Calories data parsed:', data);

    if (data.status === 'success' && data.data && data.data.length > 0) {
      const chartElement = document.getElementById('caloriesChart');
      if (!chartElement) {
        console.error('Calories chart element not found');
        return;
      }

      // Clear existing content
      chartElement.innerHTML = '';

      // Destroy existing chart if it exists
      if (window.caloriesChart && typeof window.caloriesChart.destroy === 'function') {
        window.caloriesChart.destroy();
      }

      const caloriesData = data.data;
      const dates = caloriesData.map(c => c.date);
      const calories = caloriesData.map(c => c.total_calories);

      const options = {
        series: [
          {
            name: 'Daily Calories',
            data: calories,
            type: 'column'
          }
        ],
        chart: {
          height: 300,
          type: 'bar',
          zoom: {
            enabled: true
          },
          toolbar: {
            show: true,
            tools: {
              download: true,
              selection: true,
              zoom: true,
              zoomin: true,
              zoomout: true,
              pan: true,
              reset: true
            }
          }
        },
        colors: ['#8B5CF6'],
        dataLabels: {
          enabled: true,
          formatter: function (val) {
            return Math.round(val);
          },
          style: {
            fontSize: '10px',
            colors: ['#8B5CF6']
          }
        },
        stroke: {
          curve: 'smooth',
          width: 0
        },
        fill: {
          type: 'solid',
          opacity: 0.8
        },
        markers: {
          size: 0
        },
        xaxis: {
          categories: dates,
          title: {
            text: 'Date'
          }
        },
        yaxis: {
          title: {
            text: 'Calories'
          },
          labels: {
            formatter: function (value) {
              return value + ' cal';
            }
          },
          min: 1200,
          max: 2500
        },
        tooltip: {
          y: {
            formatter: function (value) {
              return value + ' cal';
            }
          }
        },
        legend: {
          position: 'top'
        },
        grid: {
          borderColor: '#e7e7e7',
          row: {
            colors: ['#f3f3f3', 'transparent'],
            opacity: 0.5
          }
        }
      };

      try {
        window.caloriesChart = new ApexCharts(chartElement, options);
        window.caloriesChart.render();
        console.log('Calories chart rendered successfully');
      } catch (chartError) {
        console.error('Error creating calories chart:', chartError);
        chartElement.innerHTML = '<div class="text-red-500 text-center py-4">Error creating calories chart</div>';
      }
    } else {
      const chartElement = document.getElementById('caloriesChart');
      if (chartElement) {
        chartElement.innerHTML = `
          <div class="flex items-center justify-center h-64 text-gray-500">
            <div class="text-center">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p class="mt-2 text-sm">No calories data available</p>
              <p class="text-xs text-gray-400 mt-1">Add some meal logs to see your daily calories</p>
            </div>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Error loading calories chart:', error);
    const chartElement = document.getElementById('caloriesChart');
    if (chartElement) {
      chartElement.innerHTML = `
        <div class="flex items-center justify-center h-64 text-red-500">
          <div class="text-center">
            <svg class="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="mt-2 text-sm">Error loading calories chart</p>
            <p class="text-xs text-red-400 mt-1">${error.message}</p>
          </div>
        </div>
      `;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded event fired');
  updateMealSelect();
  setTodayForLogDate();
  renderTodayMeals();
  loadSavedMeals();
  loadLatestBPReading();

  // Set default dates for calendar
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 6);
  const calendarEnd = document.getElementById('calendarEnd');
  const calendarStart = document.getElementById('calendarStart');
  if (calendarEnd) {
    calendarEnd.value = getLocalDate(today);
  }
  if (calendarStart) {
    calendarStart.value = getLocalDate(weekAgo);
  }

  if (document.getElementById('weightLogForm')) {
    // Set today as default date
    const weightLogDate = document.getElementById('weightLogDate');
    if (weightLogDate) {
      weightLogDate.value = getTodayLocalDate();
    }
    loadTodayWeight();
    loadRecentWeights();
    loadWeightChart();

    // Add event listeners for weight navigation (with null checks)
    const prevWeekBtn = document.getElementById('prevWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');

    if (prevWeekBtn) {
      prevWeekBtn.addEventListener('click', goToPreviousWeightWeek);
    }
    if (nextWeekBtn) {
      nextWeekBtn.addEventListener('click', goToNextWeightWeek);
    }
  }

  // Start the midnight checking timer
  startMidnightCheckTimer();

  // Load charts
  console.log('About to load blood pressure chart...');
  loadBloodPressureChart();
  console.log('About to load calories chart...');
  loadCaloriesChart();

  // Add event listeners for report functionality
  const generateReportBtn = document.getElementById('generateReport');
  const printReportBtn = document.getElementById('printReport');
  const downloadReportBtn = document.getElementById('downloadReport');

  if (generateReportBtn) {
    generateReportBtn.addEventListener('click', generateDoctorsReport);
  }

  if (printReportBtn) {
    printReportBtn.addEventListener('click', printReport);
  }

  if (downloadReportBtn) {
    downloadReportBtn.addEventListener('click', downloadReport);
  }

  // Add calendar load button event listener
  const loadCalendarBtn = document.getElementById('loadCalendar');
  if (loadCalendarBtn) {
    loadCalendarBtn.addEventListener('click', loadCalendar);
  }
});

// Clean up timer when page is unloaded
window.addEventListener('beforeunload', () => {
  stopMidnightCheckTimer();
});

// ===== DOCTOR'S REPORT FUNCTIONALITY =====

// Generate comprehensive report for doctor
async function generateDoctorsReport() {
  try {
    const reportContainer = document.getElementById('reportContainer');
    const reportContent = document.getElementById('reportContent');

    // Show loading state
    reportContent.innerHTML = `
      <div class="flex items-center justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span class="ml-2 text-gray-600">Generating report...</span>
      </div>
    `;
    reportContainer.classList.remove('hidden');

    // Calculate date range (last 14 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 13); // 14 days total including today

    const startDateStr = getLocalDate(startDate);
    const endDateStr = getLocalDate(endDate);

    // Get expanded date range for blood pressure to account for timezone differences
    const expandedRange = getExpandedDateRange(startDateStr, endDateStr);

    // Fetch all data for the date range
    const [caloriesData, weightData, bloodPressureData] = await Promise.all([
      fetch(`/api/calories_range?start=${startDateStr}&end=${endDateStr}`).then(r => r.json()),
      fetch(`/api/weight_log_range?start=${startDateStr}&end=${endDateStr}`).then(r => r.json()),
      fetch(`/api/blood_pressure_range?start=${expandedRange.start}&end=${expandedRange.end}`).then(r => r.json())
    ]);

    // Generate the report HTML
    const reportHTML = generateReportHTML(startDateStr, endDateStr, caloriesData, weightData, bloodPressureData);

    reportContent.innerHTML = reportHTML;

  } catch (error) {
    console.error('Error generating report:', error);
    document.getElementById('reportContent').innerHTML = `
      <div class="text-red-500 text-center py-4">
        <svg class="mx-auto h-12 w-12 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-lg font-semibold">Error generating report</p>
        <p class="text-sm text-red-400 mt-2">${error.message}</p>
      </div>
    `;
  }
}

// Generate the HTML content for the report
function generateReportHTML(startDate, endDate, caloriesData, weightData, bloodPressureData) {
  const today = new Date();
  const reportDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Process calories data
  const caloriesMap = {};
  if (caloriesData.status === 'success' && caloriesData.data) {
    caloriesData.data.forEach(day => {
      caloriesMap[day.date] = day.total_calories;
    });
  }

  // Process weight data
  const weightMap = {};
  if (weightData.status === 'success' && weightData.weights) {
    weightData.weights.forEach(day => {
      weightMap[day.date] = day.weight;
    });
  }

  // Process blood pressure data
  const bpReadings = [];
  if (bloodPressureData.status === 'success' && bloodPressureData.readings) {
    bloodPressureData.readings.forEach(reading => {
      const date = getLocalDateFromUTC(reading.timestamp);
      bpReadings.push({
        date: date,
        systolic: reading.systolic,
        diastolic: reading.diastolic,
        timestamp: reading.timestamp
      });
    });
  }

  // Generate daily entries for the full 14-day period
  const dailyEntries = [];
  const currentDate = new Date(startDate);
  const endDateObj = new Date(endDate);

  while (currentDate <= endDateObj) {
    const dateStr = getLocalDate(currentDate);
    const displayDate = currentDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    dailyEntries.push({
      date: dateStr,
      displayDate: displayDate,
      calories: caloriesMap[dateStr] || 0,
      weight: weightMap[dateStr] || null,
      bloodPressure: bpReadings.filter(bp => bp.date === dateStr)
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calculate summary statistics
  const totalCalories = dailyEntries.reduce((sum, day) => sum + day.calories, 0);
  const avgCalories = totalCalories / dailyEntries.length;
  const daysWithData = dailyEntries.filter(day => day.calories > 0).length;

  const weights = dailyEntries.filter(day => day.weight !== null).map(day => day.weight);
  const avgWeight = weights.length > 0 ? weights.reduce((sum, w) => sum + w, 0) / weights.length : null;
  const minWeight = weights.length > 0 ? Math.min(...weights) : null;
  const maxWeight = weights.length > 0 ? Math.max(...weights) : null;

  const totalBPReadings = bpReadings.length;
  const avgSystolic = bpReadings.length > 0 ?
    bpReadings.reduce((sum, bp) => sum + bp.systolic, 0) / bpReadings.length : null;
  const avgDiastolic = bpReadings.length > 0 ?
    bpReadings.reduce((sum, bp) => sum + bp.diastolic, 0) / bpReadings.length : null;

  return `
    <div class="report-content" style="font-family: 'Times New Roman', serif; line-height: 1.6;">
      <!-- Header -->
      <div class="text-center mb-8 border-b-2 border-gray-300 pb-4">
        <h1 class="text-3xl font-bold text-gray-800 mb-2">Health Data Report</h1>
        <p class="text-lg text-gray-600">Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</p>
        <p class="text-sm text-gray-500">Generated on: ${reportDate}</p>
      </div>

      <!-- Summary Section -->
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-gray-800 mb-4 border-b border-gray-300 pb-2">Summary</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 class="font-semibold text-blue-800 mb-2">Calories</h3>
            <p class="text-2xl font-bold text-blue-600">${Math.round(avgCalories)}</p>
            <p class="text-sm text-blue-600">Average daily calories</p>
            <p class="text-xs text-blue-500 mt-1">${daysWithData} days with data</p>
          </div>
          ${avgWeight ? `
          <div class="bg-green-50 p-4 rounded-lg border border-green-200">
            <h3 class="font-semibold text-green-800 mb-2">Weight</h3>
            <p class="text-2xl font-bold text-green-600">${avgWeight.toFixed(1)} lbs</p>
            <p class="text-sm text-green-600">Average weight</p>
            <p class="text-xs text-green-500 mt-1">Range: ${minWeight.toFixed(1)} - ${maxWeight.toFixed(1)} lbs</p>
          </div>
          ` : `
          <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 class="font-semibold text-gray-800 mb-2">Weight</h3>
            <p class="text-lg text-gray-600">No data</p>
          </div>
          `}
          ${totalBPReadings > 0 ? `
          <div class="bg-red-50 p-4 rounded-lg border border-red-200">
            <h3 class="font-semibold text-red-800 mb-2">Blood Pressure</h3>
            <p class="text-2xl font-bold text-red-600">${Math.round(avgSystolic)}/${Math.round(avgDiastolic)}</p>
            <p class="text-sm text-red-600">Average BP</p>
            <p class="text-xs text-red-500 mt-1">${totalBPReadings} readings</p>
          </div>
          ` : `
          <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 class="font-semibold text-gray-800 mb-2">Blood Pressure</h3>
            <p class="text-lg text-gray-600">No data</p>
          </div>
          `}
        </div>
      </div>

      <!-- Daily Data Table -->
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-gray-800 mb-4 border-b border-gray-300 pb-2">Daily Data</h2>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse border border-gray-300">
            <thead>
              <tr class="bg-gray-100">
                <th class="border border-gray-300 px-3 py-2 text-left font-semibold">Date</th>
                <th class="border border-gray-300 px-3 py-2 text-center font-semibold">Calories</th>
                <th class="border border-gray-300 px-3 py-2 text-center font-semibold">Weight (lbs)</th>
                <th class="border border-gray-300 px-3 py-2 text-center font-semibold">Blood Pressure</th>
              </tr>
            </thead>
            <tbody>
              ${dailyEntries.map(day => `
                <tr class="hover:bg-gray-50">
                  <td class="border border-gray-300 px-3 py-2 font-medium">${day.displayDate}</td>
                  <td class="border border-gray-300 px-3 py-2 text-center">${day.calories > 0 ? day.calories : '-'}</td>
                  <td class="border border-gray-300 px-3 py-2 text-center">${day.weight ? day.weight.toFixed(1) : '-'}</td>
                  <td class="border border-gray-300 px-3 py-2 text-center">
                    ${day.bloodPressure.length > 0 ?
      day.bloodPressure.map(bp => `${bp.systolic}/${bp.diastolic}`).join(', ') :
      '-'
    }
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Blood Pressure Details -->
      ${totalBPReadings > 0 ? `
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-gray-800 mb-4 border-b border-gray-300 pb-2">Blood Pressure Readings</h2>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse border border-gray-300">
            <thead>
              <tr class="bg-gray-100">
                <th class="border border-gray-300 px-3 py-2 text-left font-semibold">Date</th>
                <th class="border border-gray-300 px-3 py-2 text-center font-semibold">Time</th>
                <th class="border border-gray-300 px-3 py-2 text-center font-semibold">Systolic</th>
                <th class="border border-gray-300 px-3 py-2 text-center font-semibold">Diastolic</th>
                <th class="border border-gray-300 px-3 py-2 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              ${bpReadings.map(reading => {
      const bpDate = new Date(reading.timestamp);
      const timeStr = bpDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
      const dateStr = bpDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });

      // Determine BP status
      let status = 'Normal';
      let statusClass = 'text-green-600';
      if (reading.systolic >= 140 || reading.diastolic >= 90) {
        status = 'High';
        statusClass = 'text-red-600';
      } else if (reading.systolic < 90 || reading.diastolic < 60) {
        status = 'Low';
        statusClass = 'text-blue-600';
      }

      return `
                  <tr class="hover:bg-gray-50">
                    <td class="border border-gray-300 px-3 py-2">${dateStr}</td>
                    <td class="border border-gray-300 px-3 py-2 text-center">${timeStr}</td>
                    <td class="border border-gray-300 px-3 py-2 text-center">${reading.systolic}</td>
                    <td class="border border-gray-300 px-3 py-2 text-center">${reading.diastolic}</td>
                    <td class="border border-gray-300 px-3 py-2 text-center ${statusClass} font-medium">${status}</td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}

      <!-- Notes Section -->
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-gray-800 mb-4 border-b border-gray-300 pb-2">Notes</h2>
        <div class="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <p class="text-sm text-gray-700">
            <strong>Data Coverage:</strong> This report covers ${daysWithData} out of 14 days with calorie data. 
            ${weights.length > 0 ? `Weight data available for ${weights.length} days.` : 'No weight data available.'}
            ${totalBPReadings > 0 ? `${totalBPReadings} blood pressure readings recorded.` : 'No blood pressure data available.'}
          </p>
          <p class="text-sm text-gray-700 mt-2">
            <strong>Recommendations:</strong> Please consult with your healthcare provider to interpret these results 
            and discuss any concerns about your health data.
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="text-center text-sm text-gray-500 border-t border-gray-300 pt-4">
        <p>This report was generated automatically by the Diet App</p>
        <p>For medical advice, please consult with your healthcare provider</p>
      </div>
    </div>
  `;
}

// Print report function
function printReport() {
  const reportContent = document.getElementById('reportContent');
  const printWindow = window.open('', '_blank');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Health Data Report</title>
      <style>
        body { font-family: 'Times New Roman', serif; margin: 20px; line-height: 1.6; }
        .report-content { max-width: 800px; margin: 0 auto; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { border: 1px solid #ccc; padding: 15px; border-radius: 5px; }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      ${reportContent.innerHTML}
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

// Download PDF function (basic implementation)
function downloadReport() {
  // For now, we'll use the browser's print to PDF functionality
  // In a production app, you might want to use a library like jsPDF or html2pdf
  printReport();
}