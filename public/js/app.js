// DOM Elements
const homeLink = document.getElementById('homeLink');
const historyLink = document.getElementById('historyLink');
const profileLink = document.getElementById('profileLink');
const authLink = document.getElementById('authLink');

const homeSection = document.getElementById('homeSection');
const historySection = document.getElementById('historySection');
const profileSection = document.getElementById('profileSection');
const authSection = document.getElementById('authSection');

const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const loginContent = document.getElementById('loginContent');
const registerContent = document.getElementById('registerContent');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

const compareBtn = document.getElementById('compareBtn');
const resultsContainer = document.getElementById('resultsContainer');
const historyContainer = document.getElementById('historyContainer');
const profileContainer = document.getElementById('profileContainer');

const pickupInput = document.getElementById('pickup');
const destinationInput = document.getElementById('destination');

const toast = document.getElementById('toast');

// API Base URL
const API_BASE_URL = '/api';

// Store JWT token
let token = localStorage.getItem('token');
let currentUser = null;

// Google Places Autocomplete objects
let pickupAutocomplete;
let destinationAutocomplete;

// Store the selected place details
let selectedPickup = null;
let selectedDestination = null;

// Check if user is logged in
const isLoggedIn = () => {
  return !!token;
};

// Initialize app
const init = () => {
  updateUI();
  setupEventListeners();
  
  // Initialize Google Places Autocomplete
  initPlacesAutocomplete();
  
  // If logged in, get user data
  if (isLoggedIn()) {
    getUserProfile();
  }
};

// Update UI based on authentication state
const updateUI = () => {
  if (isLoggedIn()) {
    authLink.textContent = 'Logout';
    profileLink.style.display = 'block';
    historyLink.style.display = 'block';
  } else {
    authLink.textContent = 'Login';
    profileLink.style.display = 'none';
    historyLink.style.display = 'none';
  }
};

// Set up event listeners
const setupEventListeners = () => {
  // Navigation links
  homeLink.addEventListener('click', (e) => {
    e.preventDefault();
    showSection(homeSection);
    setActiveLink(homeLink);
  });

  historyLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (!isLoggedIn()) {
      showToast('Please login to view history', 'error');
      showSection(authSection);
      setActiveLink(authLink);
      return;
    }
    getSearchHistory();
    showSection(historySection);
    setActiveLink(historyLink);
  });

  profileLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (!isLoggedIn()) {
      showToast('Please login to view profile', 'error');
      showSection(authSection);
      setActiveLink(authLink);
      return;
    }
    showSection(profileSection);
    setActiveLink(profileLink);
  });

  authLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (isLoggedIn()) {
      logout();
    } else {
      showSection(authSection);
      setActiveLink(authLink);
    }
  });

  // Auth tabs
  loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginContent.classList.add('active');
    registerContent.classList.remove('active');
  });

  registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerContent.classList.add('active');
    loginContent.classList.remove('active');
  });

  // Forms
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    login();
  });

  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    register();
  });

  // Compare button
  compareBtn.addEventListener('click', () => {
    if (!pickupInput.value || !destinationInput.value) {
      showToast('Please enter pickup and destination locations', 'error');
      return;
    }
    
    compareRidePrices();
  });
  
  // Handle input clearing for pickup and destination
  pickupInput.addEventListener('input', (e) => {
    if (e.target.value === '') {
      selectedPickup = null;
    }
  });
  
  destinationInput.addEventListener('input', (e) => {
    if (e.target.value === '') {
      selectedDestination = null;
    }
  });
};

// Show specific section
const showSection = (section) => {
  homeSection.classList.remove('active');
  historySection.classList.remove('active');
  profileSection.classList.remove('active');
  authSection.classList.remove('active');

  section.classList.add('active');
};

// Set active navigation link
const setActiveLink = (link) => {
  homeLink.classList.remove('active');
  historyLink.classList.remove('active');
  profileLink.classList.remove('active');
  authLink.classList.remove('active');

  link.classList.add('active');
};

// Show toast notification
const showToast = (message, type = '') => {
  toast.textContent = message;
  toast.className = 'toast show';
  
  if (type) {
    toast.classList.add(type);
  }

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
};

// API call helper function
const apiCall = async (endpoint, method = 'GET', data = null) => {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.error || 'Something went wrong');
    }

    return responseData;
  } catch (error) {
    showToast(error.message, 'error');
    throw error;
  }
};

// Login function
const login = async () => {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await apiCall('/auth/login', 'POST', { email, password });
    token = response.token;
    localStorage.setItem('token', token);
    
    showToast('Login successful', 'success');
    await getUserProfile();
    updateUI();
    showSection(homeSection);
    setActiveLink(homeLink);
    
    // Reset form
    loginForm.reset();
  } catch (error) {
    console.error('Login error:', error);
  }
};

// Register function
const register = async () => {
  const name = document.getElementById('registerName').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (password !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }

  try {
    const response = await apiCall('/auth/register', 'POST', { name, email, password });
    token = response.token;
    localStorage.setItem('token', token);
    
    showToast('Registration successful', 'success');
    await getUserProfile();
    updateUI();
    showSection(homeSection);
    setActiveLink(homeLink);
    
    // Reset form
    registerForm.reset();
  } catch (error) {
    console.error('Registration error:', error);
  }
};

// Logout function
const logout = () => {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  
  updateUI();
  showToast('Logged out successfully', 'success');
  showSection(homeSection);
  setActiveLink(homeLink);
};

// Get user profile
const getUserProfile = async () => {
  try {
    const response = await apiCall('/auth/me');
    currentUser = response.data;
    
    // Update profile section
    profileContainer.innerHTML = `
      <div class="profile-info">
        <h3>User Information</h3>
        <p><strong>Name:</strong> ${currentUser.name}</p>
        <p><strong>Email:</strong> ${currentUser.email}</p>
        <p><strong>Account Created:</strong> ${new Date(currentUser.createdAt).toLocaleDateString()}</p>
      </div>
    `;
    
    return currentUser;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

// Initialize Google Places Autocomplete
const initPlacesAutocomplete = () => {
  // Initialize autocomplete for pickup input
  pickupAutocomplete = new google.maps.places.Autocomplete(pickupInput, {
    types: ['address'],
    componentRestrictions: { country: [] } // No country restriction, can be limited to specific countries
  });
  
  // Initialize autocomplete for destination input
  destinationAutocomplete = new google.maps.places.Autocomplete(destinationInput, {
    types: ['address'],
    componentRestrictions: { country: [] }
  });
  
  // Add listeners for place selection
  pickupAutocomplete.addListener('place_changed', () => {
    const place = pickupAutocomplete.getPlace();
    handlePlaceSelection(place, 'pickup');
  });
  
  destinationAutocomplete.addListener('place_changed', () => {
    const place = destinationAutocomplete.getPlace();
    handlePlaceSelection(place, 'destination');
  });
  
  // Prevent form submission on enter key in the input fields
  pickupInput.addEventListener('keydown', preventSubmitOnEnter);
  destinationInput.addEventListener('keydown', preventSubmitOnEnter);
};

// Handle place selection from autocomplete
const handlePlaceSelection = (place, type) => {
  if (!place.geometry) {
    // User entered the name of a place that was not suggested
    showToast(`No details available for: ${place.name}`, 'warning');
    return;
  }
  
  // Get place details
  const placeDetails = {
    address: place.formatted_address,
    name: place.name,
    lat: place.geometry.location.lat(),
    lng: place.geometry.location.lng(),
    placeId: place.place_id
  };
  
  console.log(`Selected ${type} location:`, placeDetails);
  
  // Store the selected place
  if (type === 'pickup') {
    selectedPickup = placeDetails;
  } else {
    selectedDestination = placeDetails;
  }
  
  // If both pickup and destination are selected, enable the compare button
  if (selectedPickup && selectedDestination) {
    compareBtn.disabled = false;
  }
};

// Prevent form submission when pressing Enter in autocomplete fields
const preventSubmitOnEnter = (e) => {
  if (e.key === 'Enter' && e.target.nodeName === 'INPUT') {
    e.preventDefault();
  }
};

// Modify the compareRidePrices function to use the selected place details
const compareRidePrices = async () => {
  // Get values from inputs (in case user didn't select from autocomplete)
  const pickup = pickupInput.value;
  const destination = destinationInput.value;
  
  if (!pickup || !destination) {
    showToast('Please enter pickup and destination locations', 'error');
    return;
  }
  
  // Show loading state
  resultsContainer.style.display = 'block';
  resultsContainer.innerHTML = '<p class="loading">Loading price comparisons...</p>';
  
  try {
    // Use the selected place details if available, otherwise use input text
    const requestData = {
      pickup: selectedPickup ? {
        address: selectedPickup.address,
        coordinates: {
          lat: selectedPickup.lat,
          lng: selectedPickup.lng
        },
        placeId: selectedPickup.placeId
      } : pickup,
      
      destination: selectedDestination ? {
        address: selectedDestination.address,
        coordinates: {
          lat: selectedDestination.lat,
          lng: selectedDestination.lng
        },
        placeId: selectedDestination.placeId
      } : destination
    };
    
    let response;
    
    if (isLoggedIn()) {
      response = await apiCall('/prices/compare', 'POST', requestData);
      showToast('Search saved to your history', 'success');
    } else {
      // If not logged in, use mock data but still show accurate distances
      response = await mockComparisonResponse(requestData);
      showToast('Login to save this search to your history', 'info');
    }
    
    displayResults(response.data);
    
    // Reset selected places after search
    selectedPickup = null;
    selectedDestination = null;
  } catch (error) {
    resultsContainer.innerHTML = '<p class="error">Error loading price comparisons. Please try again.</p>';
    console.error('Error comparing prices:', error);
  }
};

// Display comparison results
const displayResults = (data) => {
  // Extract distance info if it exists
  const distanceInfo = data.distanceInfo || null;
  delete data.distanceInfo; // Remove from data so we don't display it as a service
  
  resultsContainer.innerHTML = '<h3>Price Comparison Results</h3>';
  
  // Display distance and duration information if available
  if (distanceInfo) {
    resultsContainer.innerHTML += `
      <div class="distance-info">
        <p><strong>Distance:</strong> ${distanceInfo.distance.text}</p>
        <p><strong>Estimated Travel Time:</strong> ${distanceInfo.duration.text}</p>
      </div>
    `;
  }
  
  // Create sections for each service
  for (const service in data) {
    const serviceData = data[service];
    
    const serviceDiv = document.createElement('div');
    serviceDiv.className = 'ride-service';
    serviceDiv.innerHTML = `<h3>${capitalizeFirstLetter(service)}</h3>`;
    
    if (serviceData.error) {
      serviceDiv.innerHTML += `<p class="error">${serviceData.error}</p>`;
    } else if (serviceData.options && serviceData.options.length > 0) {
      // Create ride options for this service
      serviceData.options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'ride-option';
        
        // Check if price is already formatted or needs formatting
        const priceDisplay = typeof option.price === 'string' 
          ? option.price 
          : `${option.currency} ${option.price}`;
        
        optionDiv.innerHTML = `
          <div class="ride-info">
            <h4>${option.name}</h4>
            <p>ETA: ${option.eta} mins | Distance: ${option.distance} km</p>
            ${option.surge_multiplier > 1 ? `<p class="surge">Surge: ${option.surge_multiplier}x</p>` : ''}
          </div>
          <div class="ride-price">
            ${option.estimate || priceDisplay}
          </div>
        `;
        serviceDiv.appendChild(optionDiv);
      });
    } else {
      serviceDiv.innerHTML += '<p>No ride options available</p>';
    }
    
    resultsContainer.appendChild(serviceDiv);
  }
  
  resultsContainer.style.display = 'block';
};

// Get search history
const getSearchHistory = async () => {
  if (!isLoggedIn()) {
    historyContainer.innerHTML = '<p class="empty-message">Login to view your search history</p>';
    return;
  }
  
  try {
    const response = await apiCall('/prices/history');
    displaySearchHistory(response.data);
  } catch (error) {
    historyContainer.innerHTML = '<p class="error">Error loading history. Please try again.</p>';
    console.error('Error fetching history:', error);
  }
};

// Display search history
const displaySearchHistory = (history) => {
  if (!history || history.length === 0) {
    historyContainer.innerHTML = '<p class="empty-message">No search history found</p>';
    return;
  }
  
  let historyHTML = '<h3>Recent Searches</h3>';
  
  history.forEach(item => {
    const date = new Date(item.createdAt).toLocaleString();
    
    historyHTML += `
      <div class="history-item" data-id="${item._id}">
        <p><strong>From:</strong> ${item.pickup.address}</p>
        <p><strong>To:</strong> ${item.destination.address}</p>
        <p class="history-date">${date}</p>
      </div>
    `;
  });
  
  historyContainer.innerHTML = historyHTML;
  
  // Add event listeners to history items
  document.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      // In a real app, we'd fetch the details of this specific search
      showToast('View search details functionality coming soon', 'info');
    });
  });
};

// Utility functions
const capitalizeFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

// Mock comparison response for non-authenticated users
const mockComparisonResponse = async (requestData) => {
  // In a real app without login, we'd still call the Google Maps API directly from frontend
  // But for this demo, we'll create a reasonable mock
  
  // Simulate a network request
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Extract pickup and destination data
  const pickup = requestData.pickup;
  const destination = requestData.destination;
  
  // Calculate a more accurate distance if we have coordinates
  let distance = 10.5; // Default distance in km
  let duration = 25; // Default duration in minutes
  
  if (pickup.coordinates && destination.coordinates) {
    // Calculate rough distance using provided coordinates
    const pickupLat = pickup.coordinates.lat;
    const pickupLng = pickup.coordinates.lng;
    const destLat = destination.coordinates.lat;
    const destLng = destination.coordinates.lng;
    
    // Use the Haversine formula to calculate actual distance
    distance = calculateDistance(pickupLat, pickupLng, destLat, destLng);
    
    // Estimate duration based on distance (average speed of 40 km/h in city)
    duration = Math.round(distance / 40 * 60);
  }
  
  return {
    success: true,
    data: {
      distanceInfo: {
        distance: { text: `${distance.toFixed(1)} km`, value: distance * 1000 },
        duration: { text: `${duration} mins`, value: duration * 60 }
      },
      uber: {
        service: 'uber',
        options: [
          {
            name: 'UberX',
            price: `$${(distance * 1.5 + 2.5).toFixed(2)}`,
            currency: 'USD',
            eta: Math.floor(Math.random() * 10) + 1,
            distance: distance.toFixed(1),
            surge_multiplier: 1.0,
            estimate: `$${(distance * 1.5 + 2.5).toFixed(2)} - $${(distance * 1.5 + 5).toFixed(2)}`
          },
          {
            name: 'UberXL',
            price: `$${(distance * 2.2 + 4).toFixed(2)}`,
            currency: 'USD',
            eta: Math.floor(Math.random() * 15) + 5,
            distance: distance.toFixed(1),
            surge_multiplier: 1.0,
            estimate: `$${(distance * 2.2 + 4).toFixed(2)} - $${(distance * 2.2 + 8).toFixed(2)}`
          }
        ]
      },
      ola: {
        service: 'ola',
        options: [
          {
            name: 'Ola Mini',
            price: `₹${(distance * 12 + 50).toFixed(2)}`,
            currency: 'INR',
            eta: Math.floor(Math.random() * 10) + 2,
            distance: distance.toFixed(1),
            surge_multiplier: 1.0,
            estimate: `₹${(distance * 12 + 50).toFixed(2)} - ₹${(distance * 12 + 100).toFixed(2)}`
          },
          {
            name: 'Ola Prime',
            price: `₹${(distance * 16 + 80).toFixed(2)}`,
            currency: 'INR',
            eta: Math.floor(Math.random() * 12) + 3,
            distance: distance.toFixed(1),
            surge_multiplier: 1.2,
            estimate: `₹${(distance * 16 + 80).toFixed(2)} - ₹${(distance * 16 + 120).toFixed(2)}`
          }
        ]
      },
      rapido: {
        service: 'rapido',
        options: [
          {
            name: 'Rapido Bike',
            price: `₹${(distance * 8 + 30).toFixed(2)}`,
            currency: 'INR',
            eta: Math.floor(Math.random() * 5) + 1,
            distance: distance.toFixed(1),
            surge_multiplier: 1.0,
            estimate: `₹${(distance * 8 + 30).toFixed(2)} - ₹${(distance * 8 + 60).toFixed(2)}`
          }
        ]
      }
    }
  };
};

// Calculate distance between two coordinates using the Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// Add a function to check OAuth connection status
function checkOAuthConnections() {
    if (!isLoggedIn()) {
        // Hide connections section if not logged in
        document.getElementById('serviceConnections').style.display = 'none';
        return;
    }
    
    // Show connections section
    document.getElementById('serviceConnections').style.display = 'block';
    
    // Check if there's an OAuth success parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const service = urlParams.get('service');
    
    if (oauthSuccess === 'true' && service === 'uber') {
        // Update UI to show the Uber account is connected
        const uberCard = document.getElementById('uberConnection');
        uberCard.classList.add('connected');
        document.getElementById('uberConnectionStatus').textContent = 'Connected';
        document.getElementById('connectUberBtn').textContent = 'Disconnect';
        
        // Show a success toast
        showToast('Successfully connected your Uber account!', 'success');
        
        // Store the connection status
        localStorage.setItem('uberConnected', 'true');
        
        // Remove parameters from URL
        const url = new URL(window.location);
        url.searchParams.delete('oauth_success');
        url.searchParams.delete('service');
        window.history.replaceState({}, '', url);
    } else {
        // Check if we have a stored connection status
        if (localStorage.getItem('uberConnected') === 'true') {
            const uberCard = document.getElementById('uberConnection');
            uberCard.classList.add('connected');
            document.getElementById('uberConnectionStatus').textContent = 'Connected';
            document.getElementById('connectUberBtn').textContent = 'Disconnect';
        }
    }
    
    // Add event listeners for the connection buttons
    document.getElementById('connectUberBtn').addEventListener('click', function(e) {
        if (this.textContent === 'Disconnect') {
            e.preventDefault(); // Prevent the default link action
            disconnectUberAccount();
        }
    });
}

// Function to disconnect an Uber account (client-side only)
function disconnectUberAccount() {
    // Update UI
    const uberCard = document.getElementById('uberConnection');
    uberCard.classList.remove('connected');
    document.getElementById('uberConnectionStatus').textContent = 'Not connected';
    document.getElementById('connectUberBtn').textContent = 'Connect';
    
    // Remove the connection status from storage
    localStorage.removeItem('uberConnected');
    
    // Show a toast
    showToast('Disconnected your Uber account.', 'info');
}

// Modify the loadProfile function to check OAuth connections
function loadProfile() {
    const profileContainer = document.getElementById('profileContainer');
    
    if (!isLoggedIn()) {
        profileContainer.innerHTML = '<p class="empty-message">Login to view your profile</p>';
        checkOAuthConnections(); // This will hide the connections section
        return;
    }
    
    const token = localStorage.getItem('token');
    
    fetch('/api/auth/me', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch profile');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            const user = data.data;
            
            // Update profile UI
            profileContainer.innerHTML = `
                <div class="profile-card">
                    <div class="profile-header">
                        <div class="profile-avatar">
                            <span>${getInitials(user.name)}</span>
                        </div>
                        <div class="profile-info">
                            <h3>${user.name}</h3>
                            <p>${user.email}</p>
                        </div>
                    </div>
                    <div class="profile-details">
                        <p><strong>Account Created:</strong> ${new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div class="profile-actions">
                        <button id="logoutBtn" class="btn btn-secondary">Logout</button>
                    </div>
                </div>
            `;
            
            // Add logout event listener
            document.getElementById('logoutBtn').addEventListener('click', logout);
            
            // Check OAuth connections
            checkOAuthConnections();
        } else {
            showToast('Could not load profile information', 'error');
            profileContainer.innerHTML = '<p class="error-message">Error loading profile</p>';
        }
    })
    .catch(error => {
        console.error('Profile error:', error);
        showToast('Could not load profile information', 'error');
        profileContainer.innerHTML = '<p class="error-message">Error loading profile</p>';
    });
}

// Helper function to get initials from name
function getInitials(name) {
    return name
        .split(' ')
        .map(part => part.charAt(0))
        .join('')
        .toUpperCase();
}

// Initialize the application
document.addEventListener('DOMContentLoaded', init); 