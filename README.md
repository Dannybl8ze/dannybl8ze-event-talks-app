# BigQuery Release Notes Tracker & X/Twitter Publisher

A premium, interactive single-page web application that pulls Google BigQuery's official release notes, formats them into a clean, searchable timeline, and helps you compose and publish character-budgeted tweets about updates in a single click.

---

## 🚀 Key Features

*   **Granular Update Parsing**: Splices the Atom feed into individual cards by category type (*Feature*, *Issue*, *Changed*, *Deprecated*, *General*).
*   **10-Minute Server Cache**: Utilizes local memory caching on the Flask backend to avoid rate-limiting or loading delays. Includes a cache-busting "Refresh" capability.
*   **Automatic Tweet Composer**:
    *   Fills template: `📢 BigQuery [Type] ([Date]): [Body] [Link] #BigQuery #GoogleCloud #GCP`.
    *   **Auto-Truncation**: Automatically accounts for hashtags, header metadata, and Twitter's standard 23-character count rule for links. If the total text exceeds 280, it trims the body text and adds `...`.
*   **Interactive SVG Progress Ring**: Displays real-time character allowances visually, flashing yellow (at 240+ characters) and warning red (at 280+) while disabling submit triggers.
*   **Network Fallback Grace**: Fallbacks to cached data if Google's feed goes down or the server loses internet access.

---

## 🛠️ Tech Stack

*   **Backend**: Python 3, Flask
*   **Frontend**: Vanilla HTML5, CSS3, ES6 JavaScript
*   **Icons**: Lucide Icons CDN
*   **Fonts**: Outfit & Plus Jakarta Sans (Google Fonts)

---

## 📂 Project Structure

*   [app.py](file:///C:/Users/User/OneDrive/Dokumenti/Google%20Antigravity/Projects/agy-cli-projects/app.py): Main entry point. Handles XML Atom fetching, cache control, regex splitting, and HTML-to-text cleaning.
*   [templates/index.html](file:///C:/Users/User/OneDrive/Dokumenti/Google%20Antigravity/Projects/agy-cli-projects/templates/index.html): Semantic layout consisting of a Search Sidebar, Release Notes Feed, and Tweet Composer Drawer.
*   [static/css/style.css](file:///C:/Users/User/OneDrive/Dokumenti/Google%20Antigravity/Projects/agy-cli-projects/static/css/style.css): Dark mode styling, HSL variables, transitions, responsive grids, and keyframe animations.
*   [static/js/app.js](file:///C:/Users/User/OneDrive/Dokumenti/Google%20Antigravity/Projects/agy-cli-projects/static/js/app.js): Handles API endpoints, search/categories filters, character counting logic, copy handlers, and Twitter web intent routing.
*   [.gitignore](file:///C:/Users/User/OneDrive/Dokumenti/Google%20Antigravity/Projects/agy-cli-projects/.gitignore): Prevents local environments (`.venv`), Python cache (`__pycache__`), and workspace metadata from being tracked.

---

## ⚙️ Installation & Running

### Prerequisites
*   Python 3.x
*   Flask 3.x (`pip install flask`)

### Steps to Run

1.  **Clone or navigate** to the project directory:
    ```bash
    cd "C:\Users\User\OneDrive\Dokumenti\Google Antigravity\Projects\agy-cli-projects"
    ```

2.  **Start the Flask Development Server**:
    ```bash
    python app.py
    ```

3.  **Open in your browser**:
    Navigate to **[http://127.0.0.1:5000](http://127.0.0.1:5000)**.

---

## 📝 Configuration & Caching Rules

*   **Cache Settings**: The feed cache is governed in `app.py` under the `FEED_CACHE` config dictionary:
    ```python
    FEED_CACHE = {
        'data': None,
        'last_updated': 0,
        'expiry': 600  # 10 minutes (in seconds)
    }
    ```
*   **Bypassing Cache**: Triggering the header's **Refresh** button appends `?force=true` to the request, forcing the server to ignore `last_updated` and query a fresh XML copy from Google.
