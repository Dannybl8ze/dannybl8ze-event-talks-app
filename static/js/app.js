// State Management
let releaseNotes = [];
let filteredNotes = [];
let selectedNote = null;
let activeCategory = 'All';
let searchQuery = '';
let includeLink = true;
let activeHashtags = ['#BigQuery', '#GoogleCloud'];

// DOM Elements
const elements = {
    notesContainer: document.getElementById('notes-container'),
    feedLoader: document.getElementById('feed-loader'),
    feedEmpty: document.getElementById('feed-empty'),
    feedError: document.getElementById('feed-error'),
    errorMessage: document.getElementById('error-message'),
    
    refreshBtn: document.getElementById('refresh-btn'),
    emptyResetBtn: document.getElementById('empty-reset-btn'),
    errorRetryBtn: document.getElementById('error-retry-btn'),
    
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    categoryFilters: document.getElementById('category-filters'),
    
    resultsCount: document.getElementById('results-count'),
    activeFilterIndicator: document.getElementById('active-filter-indicator'),
    lastSyncTime: document.getElementById('last-sync-time'),
    statusText: document.getElementById('status-text'),
    statusIndicator: document.querySelector('.status-indicator'),
    
    // Composer elements
    composerPreview: document.getElementById('composer-preview'),
    previewContent: document.querySelector('.preview-content'),
    previewPlaceholder: document.querySelector('.preview-placeholder'),
    previewBadge: document.getElementById('preview-badge'),
    previewDate: document.getElementById('preview-date'),
    previewText: document.getElementById('preview-text'),
    
    tweetTextarea: document.getElementById('tweet-textarea'),
    charProgressCircle: document.getElementById('char-progress-circle'),
    charCountText: document.getElementById('char-count-text'),
    charCounterContainer: document.querySelector('.char-counter-container'),
    btnResetTweet: document.getElementById('btn-reset-tweet'),
    btnAddLink: document.getElementById('btn-add-link'),
    btnCopyTweet: document.getElementById('btn-copy-tweet'),
    btnPublishTweet: document.getElementById('btn-publish-tweet'),
    helperChips: document.querySelectorAll('.helper-chip:not(.link-chip)'),
    toastContainer: document.getElementById('toast-container')
};

// SVG Circle Constants for Character Counter
const CIRCLE_RADIUS = 10;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS; // ~62.8318

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Setup UI components
    setupCircularProgress();
    bindEvents();
    
    // Load Initial Data
    fetchReleaseNotes(false);
});

// Setup Initial State of SVG Progress Circle
function setupCircularProgress() {
    elements.charProgressCircle.style.strokeDasharray = CIRCLE_CIRCUMFERENCE;
    elements.charProgressCircle.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE;
}

// Bind Event Listeners
function bindEvents() {
    // Refresh buttons
    elements.refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    elements.errorRetryBtn.addEventListener('click', () => fetchReleaseNotes(true));
    elements.emptyResetBtn.addEventListener('click', clearSearchAndFilters);
    
    // Search input
    elements.searchInput.addEventListener('input', handleSearch);
    elements.clearSearch.addEventListener('click', () => {
        elements.searchInput.value = '';
        handleSearch();
    });
    
    // Category filters
    elements.categoryFilters.addEventListener('click', handleCategoryFilter);
    
    // Composer text area
    elements.tweetTextarea.addEventListener('input', handleTweetTextareaInput);
    elements.btnResetTweet.addEventListener('click', resetTweetText);
    
    // Link chip toggle
    elements.btnAddLink.addEventListener('click', toggleLinkInTweet);
    
    // Copy and publish actions
    elements.btnCopyTweet.addEventListener('click', copyTweetToClipboard);
    elements.btnPublishTweet.addEventListener('click', publishTweetToX);
    
    // Hashtag chips
    elements.helperChips.forEach(chip => {
        const tag = chip.getAttribute('data-tag');
        // Set initial active state based on activeHashtags array
        if (activeHashtags.includes(tag)) {
            chip.classList.add('active');
        }
        
        chip.addEventListener('click', () => toggleHashtag(chip, tag));
    });
}

// Fetch Release Notes from backend API
async function fetchReleaseNotes(force = false) {
    showLoader();
    elements.refreshBtn.classList.add('loading');
    elements.refreshBtn.disabled = true;
    
    elements.statusText.textContent = "Syncing feed...";
    elements.statusIndicator.className = "status-indicator loading";
    
    const url = `/api/release-notes${force ? '?force=true' : ''}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            releaseNotes = data.updates;
            elements.lastSyncTime.textContent = `Sync: ${data.last_updated}`;
            elements.statusText.textContent = `Connected (${data.source === 'network' ? 'Synced' : 'Cached'})`;
            elements.statusIndicator.className = "status-indicator online";
            
            // Calculate and update category counts in sidebar
            updateCategoryCounts();
            
            // Apply filtering and render
            applyFiltersAndRender();
            
            if (force) {
                showToast("Feed refreshed successfully", "success");
            }
        } else {
            throw new Error(data.error || "Failed to load release notes");
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        showError(error.message);
        showToast("Failed to refresh release notes", "error");
    } finally {
        elements.refreshBtn.classList.remove('loading');
        elements.refreshBtn.disabled = false;
    }
}

// Render Release Notes cards
function renderNotes() {
    elements.notesContainer.innerHTML = '';
    
    if (filteredNotes.length === 0) {
        showEmpty();
        return;
    }
    
    showFeed();
    
    // Sort notes by date (latest first). The raw feed is already sorted, but let's be safe.
    // Group notes by date header to make it visually organized
    let currentDateHeader = "";
    
    filteredNotes.forEach(note => {
        // Date Header division
        if (note.date !== currentDateHeader) {
            currentDateHeader = note.date;
            const dateDivider = document.createElement('div');
            dateDivider.className = 'note-date-divider';
            // Simple styling for date headers inside feed
            dateDivider.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; margin: 15px 0 10px 0;">
                    <span style="font-family: var(--font-secondary); font-weight: 700; font-size: 0.95rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">${currentDateHeader}</span>
                    <div style="flex-grow: 1; height: 1px; background-color: var(--border-color);"></div>
                </div>
            `;
            elements.notesContainer.appendChild(dateDivider);
        }
        
        const card = document.createElement('article');
        card.className = `note-card ${selectedNote && selectedNote.id === note.id ? 'selected' : ''}`;
        card.setAttribute('data-id', note.id);
        
        // Add badges mapping
        const badgeClass = note.type.toLowerCase();
        
        card.innerHTML = `
            <div class="note-card-header">
                <div class="note-card-meta">
                    <span class="badge ${badgeClass}">${note.type}</span>
                    <span class="note-date">${note.date}</span>
                </div>
                <a href="${note.link}" target="_blank" class="note-link-icon" title="View official release notes" onclick="event.stopPropagation();">
                    <i data-lucide="external-link" class="icon-small"></i>
                </a>
            </div>
            <div class="note-body">
                ${note.html}
            </div>
            <div class="note-card-actions">
                <button class="btn-icon-text copy-card-btn" title="Copy update text">
                    <i data-lucide="copy" class="icon-small"></i>
                    <span>Copy</span>
                </button>
                <button class="btn-icon-text share-x-btn" title="Compose X Tweet">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span>Compose Tweet</span>
                </button>
            </div>
        `;
        
        // Selection Handler
        card.addEventListener('click', () => selectNoteCard(note));
        
        // Action buttons inside card
        card.querySelector('.copy-card-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            copyTextToClipboard(note.text, "Release note text copied!");
        });
        
        card.querySelector('.share-x-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            selectNoteCard(note);
            // Scroll composer into view if on mobile
            if (window.innerWidth <= 1100) {
                document.querySelector('.composer-section').scrollIntoView({ behavior: 'smooth' });
            }
        });
        
        elements.notesContainer.appendChild(card);
    });
    
    // Re-create icons for Lucide
    lucide.createIcons();
}

// Select a release note card and populate the Composer
function selectNoteCard(note) {
    selectedNote = note;
    
    // Update active class on card elements
    document.querySelectorAll('.note-card').forEach(card => {
        if (card.getAttribute('data-id') === note.id) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
    
    // Populate Composer details preview
    elements.previewPlaceholder.style.display = 'none';
    elements.previewContent.style.display = 'block';
    
    elements.previewBadge.textContent = note.type;
    elements.previewBadge.className = `badge ${note.type.toLowerCase()}`;
    elements.previewDate.textContent = note.date;
    elements.previewText.textContent = note.text;
    
    // Enable controls
    elements.tweetTextarea.removeAttribute('disabled');
    elements.btnResetTweet.removeAttribute('disabled');
    elements.btnCopyTweet.removeAttribute('disabled');
    elements.btnPublishTweet.removeAttribute('disabled');
    
    // Generate prefilled tweet
    generateAndSetTweet();
    showToast("Composer populated with update", "info");
}

// Generate the Tweet Text based on Selected Card and Active Toggles
function generateAndSetTweet() {
    if (!selectedNote) return;
    
    // Header format: 📢 BigQuery [Type] ([Date]): 
    const header = `📢 BigQuery ${selectedNote.type} (${selectedNote.date}): `;
    
    // Link format: link url (Counts as 23 chars on Twitter usually, we allocate 24 chars for size)
    const linkStr = includeLink ? ` ${selectedNote.link}` : '';
    
    // Hashtags string
    const hashtagsStr = activeHashtags.length > 0 ? ' ' + activeHashtags.join(' ') : '';
    
    // Truncation logic to prevent exceeding 280 characters.
    // Twitter link counts as 23 characters regardless of length.
    const urlDummyLength = includeLink ? 23 : 0;
    const spacingLength = includeLink ? 1 : 0; // Space before link
    const hashtagSpacing = activeHashtags.length > 0 ? 1 : 0;
    
    // Calculate size taken by meta details
    const metaLength = header.length + spacingLength + urlDummyLength + hashtagSpacing + activeHashtags.join(' ').length;
    
    // Characters left for description
    const maxDescLength = 280 - metaLength;
    
    let bodyText = selectedNote.text;
    if (bodyText.length > maxDescLength) {
        // Truncate description with space for ellipsis
        bodyText = bodyText.substring(0, maxDescLength - 4).trim() + '...';
    }
    
    // Assemble complete text
    const finalTweet = `${header}${bodyText}${linkStr}${hashtagsStr}`;
    
    elements.tweetTextarea.value = finalTweet;
    updateCharCounter();
}

// Reset Composer Text to default pre-filled template
function resetTweetText() {
    if (!selectedNote) return;
    generateAndSetTweet();
    showToast("Composer text reset to template", "info");
}

// Handle real-time manual input in the textarea
function handleTweetTextareaInput() {
    updateCharCounter();
}

// Update the circular character counter indicator
function updateCharCounter() {
    const text = elements.tweetTextarea.value;
    const charCount = text.length;
    const charsRemaining = 280 - charCount;
    
    // Update counter text
    elements.charCountText.textContent = charsRemaining;
    
    // Calculate progress fraction (0 to 1)
    const progress = Math.min(charCount, 280) / 280;
    const offset = CIRCLE_CIRCUMFERENCE - (progress * CIRCLE_CIRCUMFERENCE);
    
    // Update SVG stroke-dashoffset
    elements.charProgressCircle.style.strokeDashoffset = offset;
    
    // Update colors and warnings
    if (charCount > 280) {
        elements.charCounterContainer.classList.add('danger');
        elements.charProgressCircle.style.stroke = '#f43f5e'; // Rose
        elements.btnPublishTweet.disabled = true;
        elements.btnCopyTweet.disabled = true;
    } else if (charCount >= 240) {
        elements.charCounterContainer.classList.remove('danger');
        elements.charProgressCircle.style.stroke = '#f59e0b'; // Amber warning
        elements.btnPublishTweet.disabled = false;
        elements.btnCopyTweet.disabled = false;
    } else {
        elements.charCounterContainer.classList.remove('danger');
        elements.charProgressCircle.style.stroke = '#6366f1'; // Indigo normal
        elements.btnPublishTweet.disabled = false;
        elements.btnCopyTweet.disabled = false;
    }
}

// Toggle URL inclusion in the Tweet template
function toggleLinkInTweet() {
    if (!selectedNote) return;
    
    includeLink = !includeLink;
    if (includeLink) {
        elements.btnAddLink.classList.add('active');
        showToast("Release note link enabled", "info");
    } else {
        elements.btnAddLink.classList.remove('active');
        showToast("Release note link disabled", "info");
    }
    
    // Regenerate tweet
    generateAndSetTweet();
}

// Toggle Hashtag chips inclusion in the Tweet template
function toggleHashtag(chipElement, tag) {
    const idx = activeHashtags.indexOf(tag);
    if (idx > -1) {
        // Remove tag
        activeHashtags.splice(idx, 1);
        chipElement.classList.remove('active');
    } else {
        // Add tag
        activeHashtags.push(tag);
        chipElement.classList.add('active');
    }
    
    // Regenerate tweet if note is selected
    if (selectedNote) {
        generateAndSetTweet();
    }
}

// Copy Composer Tweet content to Clipboard
function copyTweetToClipboard() {
    const text = elements.tweetTextarea.value;
    if (!text) return;
    
    copyTextToClipboard(text, "Tweet copied to clipboard!");
}

// General copy helper
function copyTextToClipboard(text, successMsg) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg, "success");
    }).catch(err => {
        console.error("Copy failed:", err);
        showToast("Failed to copy text", "error");
    });
}

// Publish Tweet to X (Twitter Web Intent)
function publishTweetToX() {
    const text = elements.tweetTextarea.value;
    if (!text || text.length > 280) return;
    
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
    showToast("Opening X (Twitter) intent page...", "success");
}

// Search Logic
function handleSearch() {
    searchQuery = elements.searchInput.value.trim().toLowerCase();
    
    // Toggle clear button visibility
    if (searchQuery.length > 0) {
        elements.clearSearch.style.display = 'flex';
    } else {
        elements.clearSearch.style.display = 'none';
    }
    
    applyFiltersAndRender();
}

// Category Filter Click Handler
function handleCategoryFilter(e) {
    const btn = e.target.closest('.category-btn');
    if (!btn) return;
    
    // Update Active states
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    activeCategory = btn.getAttribute('data-category');
    applyFiltersAndRender();
}

// Apply Filters and Render results count
function applyFiltersAndRender() {
    filteredNotes = releaseNotes.filter(note => {
        // Category check
        const categoryMatch = (activeCategory === 'All' || note.type === activeCategory);
        
        // Search query check
        const searchMatch = !searchQuery || 
            note.date.toLowerCase().includes(searchQuery) ||
            note.type.toLowerCase().includes(searchQuery) ||
            note.text.toLowerCase().includes(searchQuery);
            
        return categoryMatch && searchMatch;
    });
    
    // Update indicators
    elements.resultsCount.textContent = `Showing ${filteredNotes.length} update${filteredNotes.length !== 1 ? 's' : ''}`;
    
    let filterDesc = [];
    if (activeCategory !== 'All') filterDesc.push(`Category: ${activeCategory}`);
    if (searchQuery) filterDesc.push(`Query: "${searchQuery}"`);
    elements.activeFilterIndicator.textContent = `Filter: ${filterDesc.length > 0 ? filterDesc.join(' | ') : 'None'}`;
    
    renderNotes();
}

// Clear all search queries and active category buttons
function clearSearchAndFilters() {
    elements.searchInput.value = '';
    searchQuery = '';
    elements.clearSearch.style.display = 'none';
    
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    const allBtn = document.querySelector('.category-btn[data-category="All"]');
    if (allBtn) allBtn.classList.add('active');
    activeCategory = 'All';
    
    applyFiltersAndRender();
}

// Count items in each category
function updateCategoryCounts() {
    const counts = {
        All: releaseNotes.length,
        Feature: 0,
        Issue: 0,
        Changed: 0,
        Deprecated: 0,
        General: 0
    };
    
    releaseNotes.forEach(note => {
        if (counts[note.type] !== undefined) {
            counts[note.type]++;
        } else {
            counts.General++;
        }
    });
    
    document.getElementById('count-all').textContent = counts.All;
    document.getElementById('count-feat').textContent = counts.Feature;
    document.getElementById('count-issue').textContent = counts.Issue;
    document.getElementById('count-changed').textContent = counts.Changed;
    document.getElementById('count-deprecated').textContent = counts.Deprecated;
    document.getElementById('count-general').textContent = counts.General;
}

// Toast Alert notification system
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';
    
    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    lucide.createIcons();
    
    // Fade out and remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Toggle View States
function showLoader() {
    elements.feedLoader.style.display = 'flex';
    elements.notesContainer.style.display = 'none';
    elements.feedEmpty.style.display = 'none';
    elements.feedError.style.display = 'none';
}

function showFeed() {
    elements.feedLoader.style.display = 'none';
    elements.notesContainer.style.display = 'flex';
    elements.feedEmpty.style.display = 'none';
    elements.feedError.style.display = 'none';
}

function showEmpty() {
    elements.feedLoader.style.display = 'none';
    elements.notesContainer.style.display = 'none';
    elements.feedEmpty.style.display = 'flex';
    elements.feedError.style.display = 'none';
}

function showError(msg) {
    elements.feedLoader.style.display = 'none';
    elements.notesContainer.style.display = 'none';
    elements.feedEmpty.style.display = 'none';
    elements.feedError.style.display = 'flex';
    elements.errorMessage.textContent = msg || "Could not connect to the BigQuery release feed.";
    
    elements.statusText.textContent = "Sync failed";
    elements.statusIndicator.className = "status-indicator offline";
}
