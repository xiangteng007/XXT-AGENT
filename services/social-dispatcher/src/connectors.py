"""
Social Media Connector Framework

Provides a standardized interface for compliant social media data collection.
All connectors must use official APIs and respect platform Terms of Service.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
import asyncio
import logging

logger = logging.getLogger(__name__)


class Platform(Enum):
    """Supported social media platforms"""
    TWITTER = "twitter"
    YOUTUBE = "youtube"
    REDDIT = "reddit"
    # Future: FACEBOOK = "facebook"
    # Future: LINE = "line"


@dataclass
class SocialPost:
    """Standardized social media post format"""
    id: str
    platform: Platform
    author: str
    author_id: str
    content: str
    url: str
    published_at: datetime
    engagement: Dict[str, int]  # likes, comments, shares, views
    media_urls: List[str]
    hashtags: List[str]
    mentions: List[str]
    language: Optional[str] = None
    sentiment: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None


@dataclass
class QuotaStatus:
    """API quota status"""
    platform: Platform
    daily_limit: int
    daily_used: int
    reset_at: datetime
    is_exhausted: bool
    
    @property
    def remaining(self) -> int:
        return max(0, self.daily_limit - self.daily_used)
    
    @property
    def usage_percent(self) -> float:
        if self.daily_limit == 0:
            return 100.0
        return (self.daily_used / self.daily_limit) * 100


class SocialConnector(ABC):
    """
    Abstract base class for social media connectors.
    All implementations must use official APIs.
    """
    
    @property
    @abstractmethod
    def platform(self) -> Platform:
        """Return the platform this connector handles"""
        pass
    
    @property
    @abstractmethod
    def api_version(self) -> str:
        """Return the API version being used"""
        pass
    
    @abstractmethod
    async def authenticate(self) -> bool:
        """
        Authenticate with the platform.
        Returns True if authentication successful.
        """
        pass
    
    @abstractmethod
    async def search_posts(
        self,
        query: str,
        limit: int = 100,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
    ) -> List[SocialPost]:
        """
        Search for posts matching the query.
        Must respect API rate limits.
        """
        pass
    
    @abstractmethod
    async def get_user_posts(
        self,
        user_id: str,
        limit: int = 50,
    ) -> List[SocialPost]:
        """
        Get posts from a specific user.
        Must respect API rate limits.
        """
        pass
    
    @abstractmethod
    async def get_quota_status(self) -> QuotaStatus:
        """
        Get current API quota status.
        """
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """
        Check if the connector is healthy and can make API calls.
        """
        pass


class TwitterConnector(SocialConnector):
    """
    Twitter/X API v2 Connector
    Uses official Twitter API v2 (OAuth 2.0)
    """
    
    def __init__(self, bearer_token: str):
        self.bearer_token = bearer_token
        self._daily_used = 0
        self._daily_limit = 1500  # Basic tier
        self._authenticated = False
    
    @property
    def platform(self) -> Platform:
        return Platform.TWITTER
    
    @property
    def api_version(self) -> str:
        return "2.0"
    
    async def authenticate(self) -> bool:
        """Verify bearer token works"""
        # In production: Make test API call
        if not self.bearer_token:
            return False
        self._authenticated = True
        logger.info("Twitter API v2 authenticated successfully")
        return True
    
    async def search_posts(
        self,
        query: str,
        limit: int = 100,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
    ) -> List[SocialPost]:
        """
        Search tweets using Twitter API v2 search/recent endpoint.
        Rate limit: 450 requests per 15-minute window (Basic tier)
        """
        if not self._authenticated:
            await self.authenticate()
        
        # In production: Use httpx/aiohttp to call Twitter API
        # GET https://api.twitter.com/2/tweets/search/recent
        
        # Placeholder for actual implementation
        logger.info(f"Searching Twitter for: {query}, limit: {limit}")
        self._daily_used += 1
        
        return []
    
    async def get_user_posts(self, user_id: str, limit: int = 50) -> List[SocialPost]:
        """Get user's recent tweets"""
        if not self._authenticated:
            await self.authenticate()
        
        # GET https://api.twitter.com/2/users/:id/tweets
        logger.info(f"Fetching tweets for user: {user_id}")
        self._daily_used += 1
        
        return []
    
    async def get_quota_status(self) -> QuotaStatus:
        return QuotaStatus(
            platform=self.platform,
            daily_limit=self._daily_limit,
            daily_used=self._daily_used,
            reset_at=datetime.utcnow().replace(hour=0, minute=0, second=0),
            is_exhausted=self._daily_used >= self._daily_limit
        )
    
    async def health_check(self) -> bool:
        return self._authenticated


class YouTubeConnector(SocialConnector):
    """
    YouTube Data API v3 Connector
    Uses official YouTube Data API v3
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self._daily_used = 0
        self._daily_limit = 10000  # Default quota units
        self._authenticated = False
    
    @property
    def platform(self) -> Platform:
        return Platform.YOUTUBE
    
    @property
    def api_version(self) -> str:
        return "3.0"
    
    async def authenticate(self) -> bool:
        if not self.api_key:
            return False
        self._authenticated = True
        logger.info("YouTube Data API v3 authenticated successfully")
        return True
    
    async def search_posts(
        self,
        query: str,
        limit: int = 50,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
    ) -> List[SocialPost]:
        """
        Search YouTube videos/comments.
        Cost: ~100 quota units per search request
        """
        if not self._authenticated:
            await self.authenticate()
        
        # GET https://www.googleapis.com/youtube/v3/search
        logger.info(f"Searching YouTube for: {query}, limit: {limit}")
        self._daily_used += 100  # Search costs ~100 units
        
        return []
    
    async def get_user_posts(self, user_id: str, limit: int = 50) -> List[SocialPost]:
        """Get channel's recent videos"""
        if not self._authenticated:
            await self.authenticate()
        
        logger.info(f"Fetching videos for channel: {user_id}")
        self._daily_used += 100
        
        return []
    
    async def get_quota_status(self) -> QuotaStatus:
        return QuotaStatus(
            platform=self.platform,
            daily_limit=self._daily_limit,
            daily_used=self._daily_used,
            reset_at=datetime.utcnow().replace(hour=0, minute=0, second=0),
            is_exhausted=self._daily_used >= self._daily_limit
        )
    
    async def health_check(self) -> bool:
        return self._authenticated


class SocialDispatcher:
    """
    Manages multiple social media connectors with quota-aware scheduling.
    """
    
    def __init__(self):
        self._connectors: Dict[Platform, SocialConnector] = {}
        self._poll_interval_seconds = 900  # 15 minutes default
    
    def register_connector(self, connector: SocialConnector) -> None:
        """Register a social connector"""
        self._connectors[connector.platform] = connector
        logger.info(f"Registered connector: {connector.platform.value} v{connector.api_version}")
    
    def get_connector(self, platform: Platform) -> Optional[SocialConnector]:
        """Get connector for a specific platform"""
        return self._connectors.get(platform)
    
    async def authenticate_all(self) -> Dict[Platform, bool]:
        """Authenticate all registered connectors"""
        results = {}
        for platform, connector in self._connectors.items():
            try:
                results[platform] = await connector.authenticate()
            except Exception as e:
                logger.error(f"Failed to authenticate {platform.value}: {e}")
                results[platform] = False
        return results
    
    async def get_all_quota_status(self) -> Dict[Platform, QuotaStatus]:
        """Get quota status from all connectors"""
        results = {}
        for platform, connector in self._connectors.items():
            try:
                results[platform] = await connector.get_quota_status()
            except Exception as e:
                logger.error(f"Failed to get quota for {platform.value}: {e}")
        return results
    
    async def search_all(
        self,
        query: str,
        platforms: Optional[List[Platform]] = None,
        limit_per_platform: int = 50,
    ) -> Dict[Platform, List[SocialPost]]:
        """
        Search across all (or specified) platforms.
        Respects quota limits.
        """
        target_platforms = platforms or list(self._connectors.keys())
        results: Dict[Platform, List[SocialPost]] = {}
        
        for platform in target_platforms:
            connector = self._connectors.get(platform)
            if not connector:
                continue
            
            # Check quota first
            quota = await connector.get_quota_status()
            if quota.is_exhausted:
                logger.warning(f"Skipping {platform.value}: quota exhausted")
                results[platform] = []
                continue
            
            try:
                posts = await connector.search_posts(query, limit=limit_per_platform)
                results[platform] = posts
            except Exception as e:
                logger.error(f"Failed to search {platform.value}: {e}")
                results[platform] = []
        
        return results
    
    async def health_check_all(self) -> Dict[Platform, bool]:
        """Check health of all connectors"""
        results = {}
        for platform, connector in self._connectors.items():
            try:
                results[platform] = await connector.health_check()
            except Exception as e:
                logger.error(f"Health check failed for {platform.value}: {e}")
                results[platform] = False
        return results


# Factory function
def create_dispatcher(config: Dict[str, str]) -> SocialDispatcher:
    """
    Create dispatcher with connectors based on config.
    
    Config example:
    {
        "TWITTER_BEARER_TOKEN": "xxx",
        "YOUTUBE_API_KEY": "xxx",
    }
    """
    dispatcher = SocialDispatcher()
    
    if config.get("TWITTER_BEARER_TOKEN"):
        dispatcher.register_connector(
            TwitterConnector(config["TWITTER_BEARER_TOKEN"])
        )
    
    if config.get("YOUTUBE_API_KEY"):
        dispatcher.register_connector(
            YouTubeConnector(config["YOUTUBE_API_KEY"])
        )
    
    return dispatcher
