// --- ADDED: Import Supabase client and Auth functions ---
// Adjust the path ('../frontpage/app.js') if your file structure is different
import { supabase, updateHeaderUI, signOutUser, fetchWishlist, addToWishlist, removeFromWishlist } from '../frontpage/app.js';

import { renderPriceChart, destroyChart, updateChartTheme } from './chart.js';

// --- WishlistManager Class (Refactored to use Supabase Backend) ---
class WishlistManager {
  constructor() {
    this.wishlist = []; // Populated from DB
    this.wishlistModal = document.getElementById('wishlistModal');
    this.wishlistTableBody = document.querySelector('#wishlistTable tbody');
    this.wishlistBtn = document.getElementById('wishlistBtn');
    window.wishlistManager = this; // Expose globally if needed

    if (this.wishlistBtn) {
      this.wishlistBtn.addEventListener('click', () => this.openWishlistModal());
    }
    if (this.wishlistModal) {
      // Setup modal close buttons and behaviors
      this.wishlistModal.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => this.closeWishlistModal());
      });
      this.wishlistModal.addEventListener('click', (e) => {
        if (e.target === this.wishlistModal) this.closeWishlistModal();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this.wishlistModal.classList.contains('hidden')) {
          this.closeWishlistModal();
        }
      });
    }
  }

  async initializeData() {
    console.log("Initializing wishlist data from database...");
    // Use the imported fetchWishlist function
    this.wishlist = await fetchWishlist();
    if (!this.wishlist) {
      // fetchWishlist handles redirect if not logged in, but might return null on API error
      this.wishlist = [];
      console.warn("Failed to fetch wishlist or fetch returned null.");
    }
    console.log("Wishlist data loaded:", this.wishlist);
    this.syncHeartForDisplayedCompany(); // Sync heart after data loads
  }

  isWishlisted(symbol) {
    if (!symbol) return false;
    // Check ticker_symbol from DB data
    return this.wishlist.some(item => item.ticker_symbol && item.ticker_symbol.toUpperCase() === symbol.toUpperCase());
  }

  async toggleWishlist(symbol, heartButton) {
    if (!symbol) return;
    const symbolUpper = symbol.toUpperCase();
    if (this.isWishlisted(symbolUpper)) {
      // Remove
      const success = await removeFromWishlist(symbolUpper); // Use imported function
      if (success) {
        this.wishlist = this.wishlist.filter(item => item.ticker_symbol.toUpperCase() !== symbolUpper);
        if (heartButton) { // Update UI
          heartButton.classList.remove('added');
          heartButton.innerHTML = '<i class="fa-regular fa-heart"></i>';
        }
      T } else {
        console.error(`Failed to remove ${symbolUpper} from wishlist.`);
        alert(`Failed to remove ${symbolUpper} from wishlist.`); // Inform user
      }
    } else {
      // Add
      const newItem = await addToWishlist(symbolUpper); // Use imported function
      if (newItem) {
        this.wishlist.push(newItem);
        if (heartButton) { // Update UI
          heartButton.classList.add('added');
          heartButton.innerHTML = '<i class="fa-solid fa-heart"></i>';
        }
      } else {
        console.error(`Failed to add ${symbolUpper} to wishlist.`);
        alert(`Failed to add ${symbolUpper} to wishlist.`); // Inform user
      }
    }
    // Re-render modal if open
    if (this.wishlistModal && !this.wishlistModal.classList.contains('hidden')) {
      // No need to await here, let it render in background if open
      this.renderWishlist();
    }
  }

  syncHeartForDisplayedCompany() {
    const heart = document.getElementById('wishlistHeartBtn');
    if (!heart) return;
    const displayedSymbol = heart.dataset.symbol;
    if (!displayedSymbol) return;
    // Check against the local cache (this.wishlist)
    if (this.isWishlisted(displayedSymbol)) {
      heart.classList.add('added');
      heart.innerHTML = '<i class="fa-solid fa-heart"></i>';
    } else {
      heart.classList.remove('added');
      heart.innerHTML = '<i class="fa-regular fa-heart"></i>';
    }
  }

  _setWishlistButtonLoading(loading) {
    if (!this.wishlistBtn) return;
    this.wishlistBtn.disabled = loading;
    this.wishlistBtn.classList.toggle('wishlist-btn-loading', loading);
    let spinner = this.wishlistBtn.querySelector('.btn-spinner');
    if (loading && !spinner) {
      spinner = document.createElement('span');
      spinner.className = 'btn-spinner';
      spinner.setAttribute('role', 'status');
      spinner.setAttribute('aria-hidden', 'true');
      this.wishlistBtn.appendChild(spinner);
    } else if (!loading && spinner) {
      spinner.remove();
    }
  }

  async renderWishlist() {
    if (!this.wishlistTableBody) {
      console.error("Wishlist table body not found!");
      return;
    }
    this.wishlistTableBody.innerHTML = '<tr><td colspan="4">Loading wishlist details...</td></tr>';

    const currentWishlist = this.wishlist || [];

    if (!Array.isArray(currentWishlist) || currentWishlist.length === 0) {
      this.wishlistTableBody.innerHTML = '<tr><td colspan="4">Your wishlist is empty.</td></tr>';
      return;
    }

    console.log("Rendering wishlist, fetching details for:", currentWishlist.map(i => i.ticker_symbol));
    const detailPromises = currentWishlist.map(item => {
      const symbol = item.ticker_symbol;
      const profileUrl = `http://localhost:3000/api/profile?symbol=${encodeURIComponent(symbol)}`;
      const quoteUrl = `http://localhost:3000/api/quote?symbol=${encodeURIComponent(symbol)}`;

      return Promise.all([
        fetch(profileUrl)
          .then(res => res.ok ? res.json() : Promise.reject(`Profile fetch failed for ${symbol} status: ${res.status}`))
          .catch(err => { console.error(`Profile fetch error for ${symbol}:`, err); return null; }),
        fetch(quoteUrl)
          .then(res => res.ok ? res.json() : Promise.reject(`Quote fetch failed for ${symbol} status: ${res.status}`))
          .catch(err => { console.error(`Quote fetch error for ${symbol}:`, err); return null; })
      ]).then(([profile, quote]) => ({
        symbol: symbol,
        profile: profile,
        quote: quote
      }));
    });

    const itemDetails = await Promise.all(detailPromises);
    console.log("Fetched wishlist details:", itemDetails);

    let tableHtml = '';
    itemDetails.forEach(details => {
      const symbol = escapeHtml(details.symbol);
      const profile = details.profile;
      const quote = details.quote;
      const companyName = escapeHtml(profile?.name || symbol);
      const sector = escapeHtml(profile?.finnhubIndustry || '-');
      let priceCell = '<span class="price-unknown">-</span>';
      let priceClass = 'price-unknown';

      if (quote && typeof quote.c === 'number' && quote.c > 0) {
        priceCell = `$${quote.c.toFixed(2)}`;
        priceClass = '';
      } else {
        console.warn(`Could not get valid price for ${symbol}`);
      }

      tableHtml += `
        <tr>
          <td><a href="#" class="wishlist-link" data-symbol="${symbol}">${companyName}</a></td>
          <td>${sector}</td>
          <td class="${priceClass}">${priceCell}</td>
          <td><button class="remove-btn" data-symbol="${symbol}">Remove</button></td>
        </tr>
      `;
    });

    this.wishlistTableBody.innerHTML = tableHtml;

    this.wishlistTableBody.querySelectorAll('.wishlist-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const symbol = e.currentTarget.dataset.symbol;
        this.closeWishlistModal();
        setTimeout(() => {
          if (window.fetchStockData) {
            window.fetchStockData(symbol);
          } else {
            console.error("fetchStockData function not found globally");
          }
        }, 150);
      });
    });

    this.wishlistTableBody.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const symbol = e.currentTarget.dataset.symbol;
        if (!symbol) return;
        btn.disabled = true;
        const success = await removeFromWishlist(symbol);

        if (success) {
          this.wishlist = this.wishlist.filter(item => item.ticker_symbol.toUpperCase() !== symbol.toUpperCase());
          this.renderWishlist();
          this.syncHeartForDisplayedCompany();
        } else {
          btn.disabled = false;
        }
      });
    });
  }


  async openWishlistModal() {
    this._setWishlistButtonLoading(true);
    try {
      console.log("Opening wishlist modal, fetching symbol list...");
      this.wishlist = await fetchWishlist();
      if (!this.wishlist) this.wishlist = [];

      await this.renderWishlist();

      if (this.wishlistModal) {
        this.wishlistModal.classList.remove('hidden');
        this.wishlistModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      }
    } catch(error){
      console.error("Error opening wishlist modal:", error);
      alert("Could not load wishlist.");
    }
    finally {
      this._setWishlistButtonLoading(false);
    }
  }

  closeWishlistModal() {
    if (this.wishlistModal) {
      this.wishlistModal.classList.add('hidden');
      this.wishlistModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }
} // End of WishlistManager Class

function escapeHtml(str = "") { /* ... unchanged ... */
  return String(str).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

// -------------------- Dashboard Main Logic --------------------
window.addEventListener('load', async () => {

  console.log("Dashboard loading, checking auth state...");
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  const user = session?.user;

  if (sessionError || !user) {
    console.error("Auth check failed:", sessionError || "No user session found");
    alert("You must be logged in to view the dashboard. Redirecting to login page.");
    window.location.href = '../frontpage/frontpage.html';
    return;
  }

  console.log("User is logged in:", user.email);
  updateHeaderUI(user);

  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', (e) => {
      e.preventDefault();
      signOutUser();
    });
  } else {
    console.warn('Dashboard logout button (#logoutButton) not found in HTML.');
  }

  const wishlistManager = new WishlistManager();
  window.wishlistManager = wishlistManager;
  try {
    await wishlistManager.initializeData();
  } catch (err) {
    console.error("Error initializing wishlist manager:", err);
  }

  const darkModeToggles = document.querySelectorAll('#darkModeToggle');
  const searchForm = document.getElementById("searchForm");
  const inputEl = document.getElementById("stockSymbol");
  const suggestionsEl = document.getElementById("suggestions");
  const searchBtn = document.getElementById("searchBtn");
    const searchSpinner = document.getElementById("searchSpinner");
  const companyPanel = document.getElementById("companyPanel");
  const stockPanel = document.getElementById("stockPanel");
  const companyLogoEl = document.getElementById("companyLogo");
  const wishlistHeartBtn = document.getElementById('wishlistHeartBtn');
  const shareButton = document.getElementById("shareButton");
  const chartTypeEl = document.getElementById("chart-type-select");
  const chartTimelineEl = document.getElementById("timeline-select");
    const dataDisplayMessage = document.getElementById("dataDisplayMessage"); // <-- Get message element

  const searchUrl = "http://localhost:3000/api/search?q=";
  const profileUrl = "http://localhost:3000/api/profile?symbol=";
  const quoteUrl = "http://localhost:3000/api/quote?symbol=";
  const candlesUrl = "http://localhost:3000/api/candles?symbol=";

  let selectedSymbol = null;
  let searchDebounce = null;
  let searchAbortController = null;
  let lastSearchResults = [];
  let lastCandlesData = null;
  let lastSharedSymbol = null;
  let chartType = "line";
  let chartTimeline = "week";
  let suggestionIndex = -1;

  function clearDisplayedData() {
        ["CompanyName","companyDescription","sector","exchange","marketCap","stockPrice","stockChange","previousClose","stockOpen","stockHigh","stockLow"].forEach(id=>{const e=document.getElementById(id);e&&(e.innerText="-")});
        companyPanel?.classList.add("hidden");
        stockPanel?.classList.add("hidden");
        if(companyLogoEl){companyLogoEl.src="";companyLogoEl.classList.add("hidden")};
        wishlistHeartBtn?.classList.add("hidden");
        if(dataDisplayMessage) {
            dataDisplayMessage.textContent = ""; // <-- Clear message
            dataDisplayMessage.className = 'data-message'; // Reset class
        }
        lastCandlesData=null;
        lastSharedSymbol=null;
        destroyChart();
    }

  function clearSuggestions() {
        searchAbortController?.abort();
        searchAbortController=null;
        if(suggestionsEl){suggestionsEl.innerHTML="";suggestionsEl.classList.remove("show");suggestionsEl.setAttribute("aria-hidden","true")};
        inputEl?.setAttribute("aria-expanded","false");
        suggestionIndex=-1;
        searchSpinner?.classList.add('hidden');
    }

    // === MODIFIED: renderSuggestions function (Filter Update) ===
  async function renderSuggestions(results) {
        if(!suggestionsEl||!inputEl) return;

        const query = inputEl.value.trim().toLowerCase();
        const validTypes = ['COMMON STOCK', 'ETF', 'ADR', 'MUTUAL FUND']; // Expanded list
        // === MODIFIED: Removed 'CORP', 'LIMITED' ===
        const excludedKeywords = ['OTC', 'PINK SHEET', 'EXPLORATION', 'MINING'];
        // === END MODIFIED ===

        const filteredResults = results
            .filter(item => {
                const symbol = item.symbol || '';
                const description = (item.description || '').toUpperCase();
                const type = (item.type || '').toUpperCase();

                // 2. Filter out symbols with '.'
                if (symbol.includes('.')) return false;

                // 3. Filter out symbols ending with 'F'
                if (symbol.endsWith('F')) return false;

                // 4. Filter based on allowed types (only if type exists and is known)
                if (type && !validTypes.includes(type)) return false;

                // 5. Filter based on excluded keywords in description
                if (excludedKeywords.some(keyword => description.includes(keyword))) return false;

                return true;
            })
            .slice(0, 10);

        // Clear previous suggestions AFTER filtering
        if(suggestionsEl) {
             suggestionsEl.innerHTML="";
             suggestionsEl.classList.remove("show");
             suggestionsEl.setAttribute("aria-hidden","true");
        }
        inputEl?.setAttribute("aria-expanded","false");
        suggestionIndex = -1;


        if(filteredResults.length === 0) {
             searchSpinner?.classList.add('hidden');
             if (query && suggestionsEl) {
                 suggestionsEl.innerHTML = `<div class="suggestion-item no-results">No matching results found.</div>`;
                 suggestionsEl.classList.add("show");
                 suggestionsEl.setAttribute("aria-hidden","false");
                 inputEl?.setAttribute("aria-expanded","true");
             }
             return;
        }

        lastSearchResults = filteredResults;

        filteredResults.forEach((item, index)=>{
            const div=document.createElement("div");
            div.className="suggestion-item";
            div.setAttribute("role","option");
            div.id = `suggestion-${index}`;
            div.setAttribute("data-symbol",item.symbol);
            div.setAttribute("data-description",item.description);
            div.innerHTML=`<span>${escapeHtml(item.description)}</span> <span>(${escapeHtml(item.symbol)})</span>`;
            div.addEventListener("click",()=>selectSuggestion(item.symbol,item.description));
            suggestionsEl.appendChild(div);
        });

        suggestionsEl.classList.add("show");
        suggestionsEl.setAttribute("aria-hidden","false");
        inputEl.setAttribute("aria-expanded","true");
    }
    // === END MODIFIED ===

  function selectSuggestion(symbol, name) {
        if(inputEl){ inputEl.value=`${name} (${symbol})`};
        selectedSymbol=symbol;
        clearSuggestions();
        fetchStockData(symbol);
    }

    // === fetchStockData function (No changes needed for filtering, but kept error handling) ===
  async function fetchStockData(symbolToFetch = null) {
        const rawInput=inputEl?inputEl.value.trim():"";
        const symbol = symbolToFetch || selectedSymbol || rawInput.match(/\(([^)]+)\)/)?.[1]?.trim() || rawInput.toUpperCase();

        if(!symbol) return console.log("No symbol provided.");

        console.log(`Fetching data for: ${symbol}`);
        clearDisplayedData();
        searchSpinner?.classList.remove('hidden'); // Show spinner while fetching main data

        try{
            const[profileResp,quoteResp,candlesResp]=await Promise.all([
                fetch(`${profileUrl}${encodeURIComponent(symbol)}`),
                fetch(`${quoteUrl}${encodeURIComponent(symbol)}`),
                fetch(`${candlesUrl}${encodeURIComponent(symbol)}`)
            ]);

            if (!profileResp.ok) {
                const errorText = await profileResp.text();
                console.error(`Profile fetch failed (${profileResp.status}):`, errorText);
                throw new Error(`Could not get company profile (${profileResp.status}).`);
            }
            if (!quoteResp.ok) {
                 const errorText = await quoteResp.text();
                 console.error(`Quote fetch failed (${quoteResp.status}):`, errorText);
                 throw new Error(`Could not get stock quote (${quoteResp.status}).`);
            }
             if (!candlesResp.ok) {
                 const errorText = await candlesResp.text();
                 console.error(`Candles fetch failed (${candlesResp.status}):`, errorText);
                 throw new Error(`Could not get price history (${candlesResp.status}).`);
            }

            const profile = await profileResp.json();
            const quote = await quoteResp.json();
            const candlesData = await candlesResp.json();

            if(!profile || Object.keys(profile).length === 0 || !profile.name || !profile.exchange || typeof quote?.c !== 'number' || quote.c === 0 ) {
                console.log(`Incomplete or zero data for ${symbol}. Profile:`, profile, "Quote:", quote);
                if (dataDisplayMessage) {
                    dataDisplayMessage.textContent = `Data for "${symbol}" is currently unavailable or incomplete.`;
                    dataDisplayMessage.className = 'data-message error';
                } else {
                     alert("Data for this symbol is currently unavailable or incomplete.");
                }
                clearDisplayedData(); // Clear partial data
                return; // Stop processing
            }

             if (dataDisplayMessage) {
                dataDisplayMessage.textContent = "";
                dataDisplayMessage.className = 'data-message';
             }

            document.getElementById("CompanyName").innerText=profile.name||"-";
            document.getElementById("companyDescription").innerText=profile.finnhubIndustry||"-";
            document.getElementById("sector").innerText=profile.finnhubIndustry||"-";
            document.getElementById("exchange").innerText=profile.exchange||"-";
            document.getElementById("marketCap").innerText=profile.marketCapitalization?`$${profile.marketCapitalization.toLocaleString()}`:"-";

            const priceEl = document.getElementById("stockPrice");
            const changeEl = document.getElementById("stockChange");
            if (priceEl) priceEl.innerText = `$${quote.c.toFixed(2)}`;
            if (changeEl) {
                const changeValue = quote.d;
                const changePercent = quote.dp;
                if(typeof changeValue === 'number' && typeof changePercent === 'number') {
                    changeEl.innerText = `${changeValue.toFixed(2)} (${changePercent.toFixed(2)}%)`;
                    changeEl.className = changeValue >= 0 ? 'pos' : 'neg';
                } else {
                    changeEl.innerText = "-";
                    changeEl.className = '';
                }
            }


            document.getElementById("previousClose").innerText=typeof quote.pc === 'number'?`$${quote.pc.toFixed(2)}`:"-";
            document.getElementById("stockOpen").innerText=typeof quote.o === 'number'?`$${quote.o.toFixed(2)}`:"-";
            document.getElementById("stockHigh").innerText=typeof quote.h === 'number'?`$${quote.h.toFixed(2)}`:"-";
            document.getElementById("stockLow").innerText=typeof quote.l === 'number'?`$${quote.l.toFixed(2)}`:"-";

            if(profile.logo && companyLogoEl){
                companyLogoEl.src = `http://localhost:3000/api/logo?url=${encodeURIComponent(profile.logo)}`;
                companyLogoEl.alt = `${profile.name} logo`;
                companyLogoEl.classList.remove("hidden");
            } else if (companyLogoEl) {
                 companyLogoEl.classList.add("hidden");
                 companyLogoEl.src = "";
            }

            if(Array.isArray(candlesData) && candlesData.length > 0){
                lastCandlesData = candlesData;
                lastSharedSymbol = symbol.toUpperCase();
                renderPriceChart(candlesData, chartType, chartTimeline);
            } else {
                 console.warn(`No valid candle data received for ${symbol}`);
                lastCandlesData = null;
                destroyChart();
            }

            companyPanel?.classList.remove("hidden");
            stockPanel?.classList.remove("hidden");

            if(wishlistHeartBtn){
                wishlistHeartBtn.dataset.symbol = symbol;
                wishlistHeartBtn.classList.remove("hidden");
                wishlistManager.syncHeartForDisplayedCompany();
            }

        } catch(err){
            console.error(`Error fetching stock data for ${symbol}:`,err);
             if (dataDisplayMessage) {
                dataDisplayMessage.textContent = `Error: ${err.message || 'Could not fetch data.'} Please check the symbol or try again.`;
                dataDisplayMessage.className = 'data-message error';
             } else {
                 alert(`Error: ${err.message || 'Could not fetch data.'}`);
             }
            clearDisplayedData();
        } finally {
            selectedSymbol = null;
            searchSpinner?.classList.add('hidden'); // Hide spinner when done fetching
        }
    }


  window.fetchStockData = fetchStockData; // Expose globally

  function updateActiveSuggestion(items) {
        items.forEach((el, i) => {
            el.classList.toggle("active", i === suggestionIndex);
            if (i === suggestionIndex) {
                inputEl?.setAttribute("aria-activedescendant", el.id);
                el.scrollIntoView({block:"nearest"});
            }
        });
    }

  function toggleDarkMode() {
        document.body.classList.toggle("light-mode");
        const isLight = document.body.classList.contains("light-mode");
        localStorage.setItem('themePreference', isLight ? 'light' : 'dark');
        setInitialButtonText();
        updateChartTheme();
    }

  function setInitialButtonText() {
        const isLightMode = document.body.classList.contains("light-mode");
        darkModeToggles.forEach(button => button.innerHTML = isLightMode?'<span>🌙 Dark Mode</span>':'<span>☀️ Light Mode</span>');
    }

    // === MODIFIED: handleShareData function (Removed Alert) ===
  async function handleShareData() {
        console.log("handleShareData called"); // Add log
        try {
            const chartPresent = !!lastCandlesData;
            const companyVisible = !companyPanel?.classList.contains("hidden");
            const stockVisible = !stockPanel?.classList.contains("hidden");

            if (!chartPresent || !companyVisible || !stockVisible) {
                console.warn("Share attempted but data not ready");
                return alert("Cannot share: Please load stock data first.");
            }

            const mainChartCanvas = document.getElementById("priceChart");
            if (!mainChartCanvas) {
                 console.warn("Share attempted but chart canvas not found");
                return alert("Cannot share: Chart canvas not found.");
            }

            const shareContainer = document.getElementById("shareSection") || document.getElementById("dashboard-main-content") || document.body;

            // REMOVED: alert("Generating share image...");

            console.log("Generating canvas for sharing...");
            const canvas = await html2canvas(shareContainer, {
                backgroundColor: getComputedStyle(document.body).backgroundColor,
                useCORS: true,
                scale: window.devicePixelRatio || 1,
                logging: false,
                scrollX: 0,
                scrollY: -window.scrollY,
                windowWidth: shareContainer.scrollWidth,
                windowHeight: shareContainer.scrollHeight
            });
            console.log("Canvas generated, creating blob...");

            canvas.toBlob(async (blob) => {
                if (!blob) {
                    console.error("Failed to create image blob.");
                    return alert("Failed to create image blob.");
                }
                console.log("Blob created, preparing share data...");

                const nameText = document.getElementById("CompanyName")?.innerText || "StockData";
                const fileNameBase = nameText.replace(/[^a-z0-9]/gi, "_").toLowerCase();
                const file = new File([blob], `${fileNameBase}_share.png`, { type: "image/png" });
                const shareData = {
                    title: `${nameText} - Analysis`,
                    text: `Stock data analysis for ${nameText}`,
                    files: [file]
                };

                console.log("Checking navigator.canShare...");
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    console.log("navigator.canShare returned true, attempting share...");
                    try {
                        await navigator.share(shareData);
                        console.log("Shared successfully");
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            console.error("Share API error:", err);
                            alert("Share failed. Downloading image instead.");
                            downloadDataUrl(canvas.toDataURL("image/png"), `${fileNameBase}_share.png`);
                        } else {
                            console.log("Share cancelled by user.");
                        }
                    }
                } else {
                    console.log("Web Share API not supported or cannot share files. Downloading image.");
                    alert("Sharing not supported. Downloading image instead.");
                    downloadDataUrl(canvas.toDataURL("image/png"), `${fileNameBase}_share.png`);
                }
            }, "image/png");

        } catch (err) {
            console.error("Error during handleShareData:", err);
            alert("Failed to generate or share image.");
        }
    }
    // === END MODIFIED ===


  function downloadDataUrl(dataUrl, filename) {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

  // --- Add Event Listeners ---
  if (searchForm) { searchForm.addEventListener("submit", (e) => { e.preventDefault(); clearSuggestions(); fetchStockData(); }); }
  if (searchBtn) { searchBtn.addEventListener("click", (e) => { e.preventDefault(); clearSuggestions(); fetchStockData(); }); }

  if (inputEl) {
        inputEl.addEventListener("input",()=>{
            selectedSymbol=null;
            clearTimeout(searchDebounce);
            if (dataDisplayMessage) dataDisplayMessage.textContent = "";
            dataDisplayMessage.className = 'data-message';
            const query = inputEl.value.trim();

            if (query.length >= 2) {
                searchSpinner?.classList.remove('hidden');
                searchDebounce = setTimeout(async() => {
                    searchAbortController?.abort();
                    searchAbortController = new AbortController();
                    try {
                        const response = await fetch(`${searchUrl}${encodeURIComponent(query)}`, {signal: searchAbortController.signal});
                        if (!response.ok) {
                            const errorText = await response.text();
                             console.error(`Search API failed (${response.status}):`, errorText);
                             throw new Error(`Search request failed (${response.status})`);
                        }
                        const data = await response.json();
                        renderSuggestions(data?.result || []);
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            console.error("Search API error:", err, ". Is the backend server (localhost:3000) running?");
                            clearSuggestions();
                             if (dataDisplayMessage) {
                                 dataDisplayMessage.textContent = "Could not fetch suggestions. Please try again later.";
                                 dataDisplayMessage.className = 'data-message error';
                             }
                        }
                         searchSpinner?.classList.add('hidden'); // Hide spinner on error/abort
                    } finally {
                        // Refined spinner hiding logic
                       if (!suggestionsEl || suggestionsEl.children.length === 0 ||
                           (suggestionsEl.children.length === 1 && suggestionsEl.firstElementChild.classList.contains('no-results')))
                       {
                            searchSpinner?.classList.add('hidden');
                       }
                       // No else needed, spinner stays visible if suggestions are shown
                    }
                }, 300);
            } else {
                clearSuggestions();
            }
        });

    inputEl.addEventListener("keydown",e=>{
            const items=Array.from(suggestionsEl?.querySelectorAll(".suggestion-item:not(.no-results)")||[]);
            if(items.length && suggestionsEl && !suggestionsEl.classList.contains("hidden")){
                if("ArrowDown"===e.key){
                    e.preventDefault();
                    suggestionIndex=(suggestionIndex+1)%items.length;
                    updateActiveSuggestion(items);
                } else if("ArrowUp"===e.key){
                    e.preventDefault();
                    suggestionIndex=(suggestionIndex-1+items.length)%items.length;
                    updateActiveSuggestion(items);
                } else if("Enter"===e.key){
                    if(suggestionIndex>=0 && items[suggestionIndex]){
                        e.preventDefault();
                        items[suggestionIndex].click();
                    } else {
                         e.preventDefault();
                         clearSuggestions();
                         fetchStockData();
                    }
                } else if("Escape"===e.key){
                    clearSuggestions();
                }
            } else if ("Enter" === e.key) {
                 e.preventDefault();
                 clearSuggestions();
                 fetchStockData();
            }
        });

    document.addEventListener("click",e=>{
            if (!searchForm?.contains(e.target)) {
                clearSuggestions();
            }
        });
  } // end if(inputEl)

  if (wishlistHeartBtn) {
    wishlistHeartBtn.addEventListener('click', () => {
      const symbol = wishlistHeartBtn.dataset.symbol;
      if (symbol) { wishlistManager.toggleWishlist(symbol, wishlistHeartBtn); }
    });
  }

  const refreshPageBtn = document.getElementById('refreshPageBtn');
  if (refreshPageBtn) { refreshPageBtn.addEventListener("click", () => { if (inputEl) inputEl.value = ""; if(dataDisplayMessage) dataDisplayMessage.textContent = ""; dataDisplayMessage.className = 'data-message'; location.reload(); }); }

  if (chartTypeEl) { chartTypeEl.addEventListener("change", () => { chartType = chartTypeEl.value; if (lastCandlesData) renderPriceChart(lastCandlesData, chartType, chartTimeline); }); }
  if (chartTimelineEl) { chartTimelineEl.addEventListener("change", () => { chartTimeline = chartTimelineEl.value; if (lastCandlesData) renderPriceChart(lastCandlesData, chartType, chartTimeline); }); }

  darkModeToggles.forEach(button => button.addEventListener('click', toggleDarkMode));

  if (shareButton) {
        // === MODIFIED: Ensure listener is attached correctly ===
        shareButton.addEventListener("click", handleShareData);
    } else {
        console.warn("#shareButton not found");
    }


  // Set initial dark/light mode state
  const savedTheme = localStorage.getItem('themePreference');
  const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    document.body.classList.remove('light-mode');
  } else {
    document.body.classList.add('light-mode');
  }
  setInitialButtonText();
  updateChartTheme(); // Update chart theme on load

});

