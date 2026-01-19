"""
Real Social Media Adapters
Implements actual API integrations for Reddit and PTT.
"""
import httpx
import logging
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
from bs4 import BeautifulSoup
import re

logger = logging.getLogger("social-worker.adapters")


class RedditAdapter:
    """
    Reddit API adapter using the public JSON endpoints.
    No authentication required for public subreddits.
    """
    
    BASE_URL = "https://www.reddit.com"
    
    def __init__(self, user_agent: str = "XXT-Agent/1.0"):
        self.user_agent = user_agent
        self.client = httpx.AsyncClient(
            headers={"User-Agent": user_agent},
            timeout=30.0
        )
    
    async def fetch_subreddit(
        self, 
        subreddit: str, 
        sort: str = "new", 
        limit: int = 25,
        after: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch posts from a subreddit.
        
        Args:
            subreddit: Name of subreddit (without r/)
            sort: Sort method (new, hot, top, rising)
            limit: Number of posts (max 100)
            after: Pagination cursor (fullname of last item)
        """
        url = f"{self.BASE_URL}/r/{subreddit}/{sort}.json"
        params = {"limit": min(limit, 100), "raw_json": 1}
        if after:
            params["after"] = after
            
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            posts = []
            for child in data.get("data", {}).get("children", []):
                post = child.get("data", {})
                posts.append({
                    "postId": post.get("id"),
                    "title": post.get("title", ""),
                    "text": post.get("selftext", ""),
                    "url": f"https://reddit.com{post.get('permalink', '')}",
                    "author": post.get("author", "[deleted]"),
                    "createdAt": datetime.fromtimestamp(post.get("created_utc", 0)).isoformat(),
                    "likes": post.get("ups", 0),
                    "comments": post.get("num_comments", 0),
                    "shares": 0,
                    "views": 0,
                    "subreddit": post.get("subreddit", subreddit),
                    "flair": post.get("link_flair_text", ""),
                })
            
            # Return pagination cursor
            next_after = data.get("data", {}).get("after")
            return posts, next_after
            
        except httpx.HTTPError as e:
            logger.error(f"Reddit API error for r/{subreddit}: {e}")
            return [], None
    
    async def search_subreddit(
        self, 
        subreddit: str, 
        query: str, 
        limit: int = 25
    ) -> List[Dict[str, Any]]:
        """Search posts within a subreddit."""
        url = f"{self.BASE_URL}/r/{subreddit}/search.json"
        params = {
            "q": query,
            "restrict_sr": "true",
            "sort": "new",
            "limit": min(limit, 100),
            "raw_json": 1
        }
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            posts = []
            for child in data.get("data", {}).get("children", []):
                post = child.get("data", {})
                posts.append({
                    "postId": post.get("id"),
                    "title": post.get("title", ""),
                    "text": post.get("selftext", ""),
                    "url": f"https://reddit.com{post.get('permalink', '')}",
                    "author": post.get("author", "[deleted]"),
                    "createdAt": datetime.fromtimestamp(post.get("created_utc", 0)).isoformat(),
                    "likes": post.get("ups", 0),
                    "comments": post.get("num_comments", 0),
                    "shares": 0,
                    "views": 0,
                    "subreddit": post.get("subreddit", subreddit),
                })
            
            return posts
            
        except httpx.HTTPError as e:
            logger.error(f"Reddit search error for r/{subreddit}: {e}")
            return []


class PTTAdapter:
    """
    PTT (批踢踢) scraper adapter.
    Uses web scraping since PTT doesn't have a public API.
    """
    
    BASE_URL = "https://www.ptt.cc"
    
    def __init__(self):
        self.client = httpx.AsyncClient(
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Cookie": "over18=1"  # Bypass age check
            },
            timeout=30.0,
            follow_redirects=True
        )
    
    async def fetch_board(
        self, 
        board: str, 
        pages: int = 1
    ) -> List[Dict[str, Any]]:
        """
        Fetch posts from a PTT board.
        
        Args:
            board: Board name (e.g., Gossiping, Stock, Tech_Job)
            pages: Number of pages to fetch (newest first)
        """
        posts = []
        
        # Start with latest page
        url = f"{self.BASE_URL}/bbs/{board}/index.html"
        
        for _ in range(pages):
            try:
                response = await self.client.get(url)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, "html.parser")
                
                # Find all post entries
                for entry in soup.select(".r-ent"):
                    try:
                        title_el = entry.select_one(".title a")
                        if not title_el:
                            continue
                        
                        title = title_el.text.strip()
                        href = title_el.get("href", "")
                        post_url = f"{self.BASE_URL}{href}"
                        
                        # Extract push count (likes equivalent)
                        push_el = entry.select_one(".nrec")
                        push_count = 0
                        if push_el:
                            push_text = push_el.text.strip()
                            if push_text.isdigit():
                                push_count = int(push_text)
                            elif push_text == "爆":
                                push_count = 100
                            elif push_text.startswith("X"):
                                push_count = -int(push_text[1:]) if len(push_text) > 1 else -10
                        
                        # Extract author
                        author_el = entry.select_one(".author")
                        author = author_el.text.strip() if author_el else "Unknown"
                        
                        # Extract date
                        date_el = entry.select_one(".date")
                        date_str = date_el.text.strip() if date_el else ""
                        
                        # Parse post ID from URL
                        post_id = href.split("/")[-1].replace(".html", "") if href else ""
                        
                        posts.append({
                            "postId": post_id,
                            "title": title,
                            "text": "",  # Would need to fetch individual post for content
                            "url": post_url,
                            "author": author,
                            "createdAt": self._parse_ptt_date(date_str),
                            "likes": push_count,
                            "comments": 0,  # Would need to fetch individual post
                            "shares": 0,
                            "views": 0,
                            "board": board,
                        })
                        
                    except Exception as e:
                        logger.warning(f"Error parsing PTT entry: {e}")
                        continue
                
                # Find previous page link
                prev_link = None
                for link in soup.select(".btn-group-paging a"):
                    if "上頁" in link.text:
                        prev_link = link.get("href")
                        break
                
                if prev_link:
                    url = f"{self.BASE_URL}{prev_link}"
                else:
                    break  # No more pages
                    
            except httpx.HTTPError as e:
                logger.error(f"PTT fetch error for {board}: {e}")
                break
        
        return posts
    
    async def fetch_post_content(self, url: str) -> Optional[str]:
        """Fetch the content of a single PTT post."""
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, "html.parser")
            content_el = soup.select_one("#main-content")
            
            if content_el:
                # Remove metadata divs
                for meta in content_el.select(".article-metaline, .article-metaline-right, .push"):
                    meta.decompose()
                
                # Get text content
                content = content_el.get_text(separator="\n", strip=True)
                
                # Clean up: remove signature line and everything after
                if "--" in content:
                    content = content.split("--")[0].strip()
                
                return content[:2000]  # Limit length
            
            return None
            
        except Exception as e:
            logger.error(f"Error fetching PTT post {url}: {e}")
            return None
    
    def _parse_ptt_date(self, date_str: str) -> str:
        """Parse PTT date format (M/DD) to ISO format."""
        try:
            now = datetime.now()
            if "/" in date_str:
                parts = date_str.split("/")
                month = int(parts[0])
                day = int(parts[1])
                year = now.year
                
                # Handle year wrap-around (e.g., December in January)
                if month > now.month:
                    year -= 1
                
                return datetime(year, month, day).isoformat()
        except Exception:
            pass
        
        return datetime.now().isoformat()


# Factory function
def create_adapter(platform: str):
    """Create the appropriate adapter for a platform."""
    adapters = {
        "reddit": RedditAdapter,
        "ptt": PTTAdapter,
    }
    
    adapter_class = adapters.get(platform.lower())
    if adapter_class:
        return adapter_class()
    
    return None
