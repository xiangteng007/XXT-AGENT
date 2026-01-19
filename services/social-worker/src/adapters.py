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


class TwitterAdapter:
    """
    Twitter/X adapter using Nitter instances (public mirror).
    Falls back to scraping if API unavailable.
    Note: For production use, Twitter API v2 with Bearer Token is recommended.
    """
    
    NITTER_INSTANCES = [
        "https://nitter.net",
        "https://nitter.privacydev.net",
        "https://nitter.poast.org",
    ]
    
    def __init__(self, bearer_token: Optional[str] = None):
        self.bearer_token = bearer_token or os.environ.get("TWITTER_BEARER_TOKEN")
        self.client = httpx.AsyncClient(
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            timeout=30.0,
            follow_redirects=True
        )
    
    async def fetch_user_timeline(
        self, 
        username: str, 
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Fetch tweets from a user's timeline.
        Uses Twitter API v2 if bearer token available, falls back to Nitter scraping.
        """
        if self.bearer_token:
            return await self._fetch_via_api(username, limit)
        else:
            return await self._fetch_via_nitter(username, limit)
    
    async def _fetch_via_api(self, username: str, limit: int) -> List[Dict[str, Any]]:
        """Fetch using Twitter API v2."""
        # First get user ID
        user_url = f"https://api.twitter.com/2/users/by/username/{username}"
        headers = {"Authorization": f"Bearer {self.bearer_token}"}
        
        try:
            response = await self.client.get(user_url, headers=headers)
            response.raise_for_status()
            user_data = response.json()
            user_id = user_data.get("data", {}).get("id")
            
            if not user_id:
                return []
            
            # Fetch tweets
            tweets_url = f"https://api.twitter.com/2/users/{user_id}/tweets"
            params = {
                "max_results": min(limit, 100),
                "tweet.fields": "created_at,public_metrics",
            }
            
            response = await self.client.get(tweets_url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            posts = []
            for tweet in data.get("data", []):
                metrics = tweet.get("public_metrics", {})
                posts.append({
                    "postId": tweet.get("id"),
                    "title": "",
                    "text": tweet.get("text", ""),
                    "url": f"https://twitter.com/{username}/status/{tweet.get('id')}",
                    "author": username,
                    "createdAt": tweet.get("created_at", ""),
                    "likes": metrics.get("like_count", 0),
                    "comments": metrics.get("reply_count", 0),
                    "shares": metrics.get("retweet_count", 0),
                    "views": metrics.get("impression_count", 0),
                })
            
            return posts
            
        except httpx.HTTPError as e:
            logger.error(f"Twitter API error for @{username}: {e}")
            return []
    
    async def _fetch_via_nitter(self, username: str, limit: int) -> List[Dict[str, Any]]:
        """Fallback: scrape Nitter instance."""
        for instance in self.NITTER_INSTANCES:
            try:
                url = f"{instance}/{username}"
                response = await self.client.get(url)
                
                if response.status_code != 200:
                    continue
                
                soup = BeautifulSoup(response.text, "html.parser")
                posts = []
                
                for tweet in soup.select(".timeline-item")[:limit]:
                    try:
                        content_el = tweet.select_one(".tweet-content")
                        link_el = tweet.select_one(".tweet-link")
                        stats = tweet.select(".tweet-stat")
                        
                        text = content_el.get_text(strip=True) if content_el else ""
                        href = link_el.get("href", "") if link_el else ""
                        
                        # Parse stats
                        likes = comments = shares = 0
                        for stat in stats:
                            icon = stat.select_one(".icon-container")
                            value = stat.select_one(".tweet-stat-value")
                            if icon and value:
                                icon_class = " ".join(icon.get("class", []))
                                count = self._parse_count(value.text)
                                if "heart" in icon_class:
                                    likes = count
                                elif "comment" in icon_class:
                                    comments = count
                                elif "retweet" in icon_class:
                                    shares = count
                        
                        posts.append({
                            "postId": href.split("/")[-1] if href else "",
                            "title": "",
                            "text": text,
                            "url": f"https://twitter.com{href}" if href.startswith("/") else href,
                            "author": username,
                            "createdAt": datetime.now().isoformat(),
                            "likes": likes,
                            "comments": comments,
                            "shares": shares,
                            "views": 0,
                        })
                    except Exception as e:
                        logger.warning(f"Error parsing tweet: {e}")
                        continue
                
                if posts:
                    return posts
                    
            except httpx.HTTPError as e:
                logger.warning(f"Nitter instance {instance} failed: {e}")
                continue
        
        logger.error(f"All Nitter instances failed for @{username}")
        return []
    
    async def search_tweets(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Search tweets by keyword (requires API access)."""
        if not self.bearer_token:
            logger.warning("Twitter search requires API bearer token")
            return []
        
        url = "https://api.twitter.com/2/tweets/search/recent"
        headers = {"Authorization": f"Bearer {self.bearer_token}"}
        params = {
            "query": query,
            "max_results": min(limit, 100),
            "tweet.fields": "created_at,public_metrics,author_id",
        }
        
        try:
            response = await self.client.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            posts = []
            for tweet in data.get("data", []):
                metrics = tweet.get("public_metrics", {})
                posts.append({
                    "postId": tweet.get("id"),
                    "title": "",
                    "text": tweet.get("text", ""),
                    "url": f"https://twitter.com/i/status/{tweet.get('id')}",
                    "author": tweet.get("author_id", ""),
                    "createdAt": tweet.get("created_at", ""),
                    "likes": metrics.get("like_count", 0),
                    "comments": metrics.get("reply_count", 0),
                    "shares": metrics.get("retweet_count", 0),
                    "views": metrics.get("impression_count", 0),
                })
            
            return posts
            
        except httpx.HTTPError as e:
            logger.error(f"Twitter search API error: {e}")
            return []
    
    def _parse_count(self, text: str) -> int:
        """Parse count strings like '1.2K' or '5M'."""
        text = text.strip().upper()
        if not text:
            return 0
        
        multipliers = {"K": 1000, "M": 1000000, "B": 1000000000}
        for suffix, mult in multipliers.items():
            if text.endswith(suffix):
                try:
                    return int(float(text[:-1]) * mult)
                except ValueError:
                    return 0
        
        try:
            return int(text.replace(",", ""))
        except ValueError:
            return 0


class WeiboAdapter:
    """
    Weibo (微博) adapter for Chinese social media monitoring.
    Uses public endpoints where available.
    """
    
    BASE_URL = "https://m.weibo.cn"
    
    def __init__(self):
        self.client = httpx.AsyncClient(
            headers={
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
                "Accept": "application/json",
            },
            timeout=30.0
        )
    
    async def search_posts(
        self, 
        keyword: str, 
        page: int = 1
    ) -> List[Dict[str, Any]]:
        """Search Weibo posts by keyword."""
        url = f"{self.BASE_URL}/api/container/getIndex"
        params = {
            "containerid": f"100103type=1&q={keyword}",
            "page_type": "searchall",
            "page": page,
        }
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            posts = []
            cards = data.get("data", {}).get("cards", [])
            
            for card in cards:
                if card.get("card_type") != 9:  # Only status cards
                    continue
                
                mblog = card.get("mblog", {})
                if not mblog:
                    continue
                
                user = mblog.get("user", {})
                
                posts.append({
                    "postId": mblog.get("id", ""),
                    "title": "",
                    "text": self._clean_weibo_text(mblog.get("text", "")),
                    "url": f"https://weibo.com/{user.get('id')}/{mblog.get('bid', '')}",
                    "author": user.get("screen_name", "Unknown"),
                    "createdAt": mblog.get("created_at", ""),
                    "likes": mblog.get("attitudes_count", 0),
                    "comments": mblog.get("comments_count", 0),
                    "shares": mblog.get("reposts_count", 0),
                    "views": 0,
                })
            
            return posts
            
        except httpx.HTTPError as e:
            logger.error(f"Weibo search error for '{keyword}': {e}")
            return []
    
    async def fetch_hot_topics(self) -> List[Dict[str, Any]]:
        """Fetch Weibo hot search topics."""
        url = f"{self.BASE_URL}/api/container/getIndex"
        params = {"containerid": "106003type=25&t=3&disable_hot=1&filter_type=realtimehot"}
        
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            topics = []
            cards = data.get("data", {}).get("cards", [])
            
            for card in cards:
                card_group = card.get("card_group", [])
                for item in card_group:
                    if item.get("card_type") == 4:
                        topics.append({
                            "topic": item.get("desc", ""),
                            "hot": item.get("desc_extr", 0),
                            "url": item.get("scheme", ""),
                        })
            
            return topics
            
        except httpx.HTTPError as e:
            logger.error(f"Weibo hot topics error: {e}")
            return []
    
    def _clean_weibo_text(self, text: str) -> str:
        """Clean HTML tags from Weibo text."""
        soup = BeautifulSoup(text, "html.parser")
        return soup.get_text(strip=True)[:1000]


# Factory function
def create_adapter(platform: str):
    """Create the appropriate adapter for a platform."""
    adapters = {
        "reddit": RedditAdapter,
        "ptt": PTTAdapter,
        "twitter": TwitterAdapter,
        "x": TwitterAdapter,  # Alias for Twitter
        "weibo": WeiboAdapter,
    }
    
    adapter_class = adapters.get(platform.lower())
    if adapter_class:
        return adapter_class()
    
    return None
