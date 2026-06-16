from flask import Flask, jsonify, render_template, request
import urllib.request
import xml.etree.ElementTree as ET
import re
import time
import hashlib

app = Flask(__name__)

# Cache structure to avoid hitting the BigQuery feed on every page load
FEED_CACHE = {
    'data': None,
    'last_updated': 0,
    'expiry': 600  # 10 minutes
}

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def clean_html_to_text(html_content):
    """Strip HTML tags and normalize whitespace for Twitter sharing."""
    # Replace links with text format or just the text
    text = re.sub(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', r'\2 (\1)', html_content)
    # Strip remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Unescape HTML entities
    import html
    text = html.unescape(text)
    # Normalize whitespaces
    text = ' '.join(text.split())
    return text

def fetch_and_parse_feed():
    """Fetches the XML Atom feed and parses it into structured updates."""
    req = urllib.request.Request(
        FEED_URL, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    )
    
    with urllib.request.urlopen(req, timeout=15) as response:
        xml_data = response.read()
        
    root = ET.fromstring(xml_data)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = root.findall('atom:entry', ns)
    parsed_updates = []
    
    for entry in entries:
        title = entry.find('atom:title', ns).text or "Unknown Date"
        updated = entry.find('atom:updated', ns).text or ""
        
        link_elem = entry.find('atom:link', ns)
        link = link_elem.attrib.get('href') if link_elem is not None else "https://cloud.google.com/bigquery/docs/release-notes"
        
        content_elem = entry.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ""
        
        # Split entry content on h3 tags which denote categories (e.g. Feature, Issue, Deprecated)
        parts = re.split(r'<h3>(.*?)</h3>', content_html)
        
        if len(parts) > 1:
            # First element is usually empty text before the first <h3>
            for i in range(1, len(parts), 2):
                update_type = parts[i].strip()
                update_html = parts[i+1].strip()
                
                # Create a unique ID for selection in UI
                hash_input = f"{title}_{update_type}_{update_html[:50]}"
                update_id = hashlib.md5(hash_input.encode('utf-8')).hexdigest()
                
                update_text = clean_html_to_text(update_html)
                
                parsed_updates.append({
                    'id': update_id,
                    'date': title,
                    'updated_raw': updated,
                    'link': link,
                    'type': update_type,
                    'html': update_html,
                    'text': update_text
                })
        else:
            # Fallback if no h3 is present
            hash_input = f"{title}_General_{content_html[:50]}"
            update_id = hashlib.md5(hash_input.encode('utf-8')).hexdigest()
            update_text = clean_html_to_text(content_html)
            
            parsed_updates.append({
                'id': update_id,
                'date': title,
                'updated_raw': updated,
                'link': link,
                'type': 'General',
                'html': content_html,
                'text': update_text
            })
            
    return parsed_updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('force', 'false').lower() == 'true'
    now = time.time()
    
    if force_refresh or not FEED_CACHE['data'] or (now - FEED_CACHE['last_updated'] > FEED_CACHE['expiry']):
        try:
            updates = fetch_and_parse_feed()
            FEED_CACHE['data'] = updates
            FEED_CACHE['last_updated'] = now
            return jsonify({
                'success': True,
                'source': 'network',
                'last_updated': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(now)),
                'updates': updates
            })
        except Exception as e:
            # Fallback to cache if available
            if FEED_CACHE['data']:
                return jsonify({
                    'success': True,
                    'source': 'cache_fallback',
                    'error': str(e),
                    'last_updated': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(FEED_CACHE['last_updated'])),
                    'updates': FEED_CACHE['data']
                })
            else:
                return jsonify({
                    'success': False,
                    'error': f"Failed to fetch feed: {str(e)}"
                }), 500
    else:
        return jsonify({
            'success': True,
            'source': 'cache',
            'last_updated': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(FEED_CACHE['last_updated'])),
            'updates': FEED_CACHE['data']
        })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
