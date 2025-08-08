class WeatherDashboard {
  constructor() {
    this.API_KEY = "927dd4645b30f399f4555276c35ee17c";
    this.weatherData = [];
    this.isLoading = false;
    this.isInitialLoad = true;

    this.initializeElements();
    this.bindEvents();
    this.loadFromStorage();
    this.initializeApp();
  }

  initializeElements() {
    this.searchForm = document.getElementById("search-form");
    this.cityInput = document.getElementById("city-input");
    this.countryInput = document.getElementById("country-input");
    this.addCityBtn = document.getElementById("add-city-btn");
    this.errorMessage = document.getElementById("error-message");
    this.errorText = document.getElementById("error-text");
    this.loadingMessage = document.getElementById("loading-message");
    this.weatherGrid = document.getElementById("weather-grid");
    this.emptyState = document.getElementById("empty-state");
  }

  bindEvents() {
    this.searchForm.addEventListener("submit", (e) => this.handleAddCity(e));
  }

  loadFromStorage() {
    const savedData = localStorage.getItem("weatherDashboardCities");
    if (savedData) {
      try {
        this.weatherData = JSON.parse(savedData);
        this.renderWeatherCards();
      } catch (error) {
        console.error("Error parsing saved weather data:", error);
        localStorage.removeItem("weatherDashboardCities");
      }
    }
  }

  saveToStorage() {
    if (this.weatherData.length > 0) {
      localStorage.setItem(
        "weatherDashboardCities",
        JSON.stringify(this.weatherData)
      );
    } else {
      localStorage.removeItem("weatherDashboardCities");
    }
  }

  async initializeApp() {
    const savedData = localStorage.getItem("weatherDashboardCities");
    if (!savedData) {
      await this.getUserLocation();
    } else {
      this.isInitialLoad = false;
      this.updateUI();
    }
  }

  async getUserLocation() {
    if (navigator.geolocation) {
      this.showLoadingMessage();
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          await this.fetchWeatherByCoords(latitude, longitude);
          this.hideLoadingMessage();
          this.isInitialLoad = false;
          this.updateUI();
        },
        (error) => {
          console.error("Geolocation error:", error);
          this.showError(
            "Unable to access your location. Please search for a city manually."
          );
          this.hideLoadingMessage();
          this.isInitialLoad = false;
          this.updateUI();
        }
      );
    } else {
      this.showError("Geolocation is not supported by this browser.");
      this.isInitialLoad = false;
      this.updateUI();
    }
  }

  async fetchWeatherByCoords(lat, lon) {
    try {
      const currentResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.API_KEY}&units=metric`
      );

      if (!currentResponse.ok) {
        const errorText = await currentResponse.text();
        throw new Error(`Unable to fetch weather data: ${errorText}`);
      }

      const currentData = await currentResponse.json();
      const forecastResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${this.API_KEY}&units=metric`
      );

      if (!forecastResponse.ok) {
        const errorText = await forecastResponse.text();
        throw new Error(`Unable to fetch forecast data: ${errorText}`);
      }

      const forecastData = await forecastResponse.json();
      const weather = this.processWeatherData(currentData, forecastData);

      // Check if user's location is already in saved cities
      const existingCity = this.weatherData.find((w) => w.id === weather.id);
      if (!existingCity) {
        this.weatherData.unshift(weather);
        this.saveToStorage();
      }

      this.hideError();
    } catch (error) {
      console.error("Error fetching weather data by coordinates:", error);
      this.showError("Failed to fetch weather data for your location");
    }
  }
  async fetchWeatherData(city) {
    try {
      const currentResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${this.API_KEY}&units=metric`
      );

      if (!currentResponse.ok) {
        throw new Error("City not found");
      }

      const currentData = await currentResponse.json();
      const forecastResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${this.API_KEY}&units=metric`
      );

      const forecastData = await forecastResponse.json();
      return this.processWeatherData(currentData, forecastData);
    } catch (error) {
      console.error("Error fetching weather data:", error);
      return null;
    }
  }

  processWeatherData(currentData, forecastData) {
    const dailyForecasts = [];
    const processedDates = new Set();

    forecastData.list.forEach((item) => {
      const date = new Date(item.dt * 1000);
      const dateStr = date.toLocaleDateString("en-US", { weekday: "short" });

      if (!processedDates.has(dateStr) && dailyForecasts.length < 3) {
        processedDates.add(dateStr);
        dailyForecasts.push({
          date: dateStr,
          temp_max: item.main.temp_max,
          temp_min: item.main.temp_min,
          weather: {
            main: item.weather[0].main,
            description: item.weather[0].description,
            icon: item.weather[0].icon,
          },
        });
      }
    });

    return {
      id: currentData.id,
      name: currentData.name,
      country: currentData.sys.country,
      current: {
        temp: currentData.main.temp,
        feels_like: currentData.main.feels_like,
        humidity: currentData.main.humidity,
        wind_speed: currentData.wind.speed,
        visibility: currentData.visibility,
        weather: {
          main: currentData.weather[0].main,
          description: currentData.weather[0].description,
          icon: currentData.weather[0].icon,
        },
      },
      forecast: dailyForecasts,
    };
  }

  async handleAddCity(e) {
    e.preventDefault();

    const cityName = this.cityInput.value.trim();
    const countryCode = this.countryInput.value.trim();

    if (!cityName) return;

    const searchQuery = countryCode ? `${cityName},${countryCode}` : cityName;

    // Check for duplicates
    if (
      this.weatherData.some(
        (weather) => weather.name.toLowerCase() === cityName.toLowerCase()
      )
    ) {
      this.showError("City already added to dashboard");
      return;
    }

    this.setLoading(true);
    this.hideError();

    const weather = await this.fetchWeatherData(searchQuery);
    if (weather) {
      this.weatherData.push(weather);
      this.saveToStorage();
      this.renderWeatherCards();
      this.cityInput.value = "";
      this.countryInput.value = "";
    } else {
      this.showError(
        "City not found. Please check the spelling and try again."
      );
    }

    this.setLoading(false);
    this.updateUI();
  }

  removeCity(id) {
    this.weatherData = this.weatherData.filter((weather) => weather.id !== id);
    this.saveToStorage();
    this.renderWeatherCards();
    this.updateUI();
  }

  setLoading(loading) {
    this.isLoading = loading;
    this.addCityBtn.disabled = loading;
    this.cityInput.disabled = loading;
    this.countryInput.disabled = loading;

    if (loading) {
      this.showLoadingSkeleton();
    }
  }

  showError(message) {
    this.errorText.textContent = message;
    this.errorMessage.classList.remove("hidden");
  }

  hideError() {
    this.errorMessage.classList.add("hidden");
  }

  showLoadingMessage() {
    this.loadingMessage.classList.remove("hidden");
  }

  hideLoadingMessage() {
    this.loadingMessage.classList.add("hidden");
  }

  showLoadingSkeleton() {
    const skeleton = this.createLoadingSkeleton();
    this.weatherGrid.appendChild(skeleton);
  }

  createLoadingSkeleton() {
    return this.createElement(
      "div",
      "loading-skeleton",
      `
            <div class="skeleton-header">
                <div>
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-subtitle"></div>
                </div>
                <div class="skeleton skeleton-icon"></div>
            </div>
            <div class="skeleton skeleton-temp"></div>
            <div class="skeleton-details">
                <div class="skeleton-detail-grid">
                    <div class="skeleton skeleton-detail"></div>
                    <div class="skeleton skeleton-detail"></div>
                    <div class="skeleton skeleton-detail"></div>
                    <div class="skeleton skeleton-detail"></div>
                </div>
            </div>
            <div class="skeleton-forecast">
                <div class="skeleton skeleton-forecast-title"></div>
                <div class="skeleton-forecast-items">
                    <div class="skeleton skeleton-forecast-item"></div>
                    <div class="skeleton skeleton-forecast-item"></div>
                    <div class="skeleton skeleton-forecast-item"></div>
                </div>
            </div>
        `
    );
  }

  updateUI() {
    // Remove loading skeletons
    const skeletons = this.weatherGrid.querySelectorAll(".loading-skeleton");
    skeletons.forEach((skeleton) => skeleton.remove());

    if (
      !this.isInitialLoad &&
      this.weatherData.length === 0 &&
      !this.isLoading
    ) {
      this.emptyState.classList.remove("hidden");
    } else {
      this.emptyState.classList.add("hidden");
    }
  }

  renderWeatherCards() {
    // Clear existing cards (but keep skeletons)
    const existingCards = this.weatherGrid.querySelectorAll(".weather-card");
    existingCards.forEach((card) => card.remove());

    this.weatherData.forEach((weather) => {
      const card = this.createWeatherCard(weather);
      this.weatherGrid.appendChild(card);
    });
  }

  createWeatherCard(weather) {
    const card = this.createElement("div", "weather-card");

    card.innerHTML = `
            <div class="card-header">
                <div class="city-info">
                    <h3>${weather.name}</h3>
                    <p>${weather.country}</p>
                </div>
                <div class="card-actions">
                    ${this.getWeatherIcon(weather.current.weather.icon)}
                    <button class="remove-btn" onclick="dashboard.removeCity(${
                      weather.id
                    })">
                        <svg class="remove-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6 6 18"/>
                            <path d="m6 6 12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="temperature">${Math.round(weather.current.temp)}°C</div>
            <div class="description">${
              weather.current.weather.description
            }</div>
            <div class="feels-like">Feels like ${Math.round(
              weather.current.feels_like
            )}°C</div>
            
            <div class="weather-details">
                <div class="detail-item">
                    <svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #3b82f6;">
                        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                    </svg>
                    <div class="detail-content">
                        <span>${weather.current.humidity}%</span>
                        <p>Humidity</p>
                    </div>
                </div>
                <div class="detail-item">
                    <svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #6b7280;">
                        <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
                        <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
                        <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
                    </svg>
                    <div class="detail-content">
                        <span>${weather.current.wind_speed} m/s</span>
                        <p>Wind</p>
                    </div>
                </div>
                <div class="detail-item">
                    <svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #6b7280;">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <div class="detail-content">
                        <span>${weather.current.visibility / 1000} km</span>
                        <p>Visibility</p>
                    </div>
                </div>
                <div class="detail-item">
                    <svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #ef4444;">
                        <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>
                    </svg>
                    <div class="detail-content">
                        <span>${Math.round(weather.current.feels_like)}°C</span>
                        <p>Feels like</p>
                    </div>
                </div>
            </div>
            
            <div class="forecast-section">
                <h4 class="forecast-title">3-Day Forecast</h4>
                <div class="forecast-list">
                    ${weather.forecast
                      .map(
                        (day) => `
                        <div class="forecast-item">
                            <span class="forecast-date">${day.date}</span>
                            <div class="forecast-weather">
                                ${this.getWeatherIcon(
                                  day.weather.icon,
                                  "forecast-icon"
                                )}
                                <span class="forecast-temp">
                                    ${Math.round(day.temp_max)}° / ${Math.round(
                          day.temp_min
                        )}°
                                </span>
                            </div>
                        </div>
                    `
                      )
                      .join("")}
                </div>
            </div>
        `;

    return card;
  }

  getWeatherIcon(iconCode, className = "weather-icon") {
    const iconMap = {
      "01d": { icon: "sun", color: "#eab308" },
      "01n": { icon: "sun", color: "#facc15" },
      "02d": { icon: "cloud", color: "#9ca3af" },
      "02n": { icon: "cloud", color: "#6b7280" },
      "03d": { icon: "cloud", color: "#6b7280" },
      "03n": { icon: "cloud", color: "#4b5563" },
      "04d": { icon: "cloud", color: "#4b5563" },
      "04n": { icon: "cloud", color: "#374151" },
      "09d": { icon: "cloud-rain", color: "#3b82f6" },
      "09n": { icon: "cloud-rain", color: "#2563eb" },
      "10d": { icon: "cloud-rain", color: "#60a5fa" },
      "10n": { icon: "cloud-rain", color: "#3b82f6" },
      "11d": { icon: "cloud-lightning", color: "#8b5cf6" },
      "11n": { icon: "cloud-lightning", color: "#7c3aed" },
      "13d": { icon: "snowflake", color: "#bfdbfe" },
      "13n": { icon: "snowflake", color: "#93c5fd" },
    };

    const iconData = iconMap[iconCode] || { icon: "cloud", color: "#9ca3af" };

    const iconSvgs = {
      sun: '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 6.34l1.41-1.41M19.07 19.07l1.41-1.41"/><circle cx="12" cy="12" r="5"/>',
      cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
      "cloud-rain":
        '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="M16 14v6M8 14v6M12 16v4"/>',
      "cloud-lightning":
        '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="M13 11l-4 6h4l-2 4"/>',
      snowflake:
        '<path d="M2 12h20M12 2v20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93"/>',
    };

    return `
            <svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: ${
      iconData.color
    };">
                ${iconSvgs[iconData.icon]}
            </svg>
        `;
  }

  createElement(tag, className, innerHTML = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = innerHTML;
    return element;
  }
}

// Initialize the dashboard when the page loads
let dashboard;
document.addEventListener("DOMContentLoaded", () => {
  dashboard = new WeatherDashboard();
});
