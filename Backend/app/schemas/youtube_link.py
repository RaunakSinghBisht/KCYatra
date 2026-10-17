from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

MAX_YOUTUBE_LINKS = 3

YOUTUBE_PATTERNS = (
    "youtube.com/watch",
    "youtube.com/shorts/",
    "youtube.com/embed/",
    "youtu.be/",
)


def is_valid_youtube_url(url: str) -> bool:
    return any(p in url for p in YOUTUBE_PATTERNS)


class YouTubeLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    position: int
    created_at: datetime


class YouTubeLinksUpdate(BaseModel):
    urls: list[str]

    @field_validator("urls")
    @classmethod
    def validate_urls(cls, v: list[str]) -> list[str]:
        if len(v) > MAX_YOUTUBE_LINKS:
            raise ValueError(f"At most {MAX_YOUTUBE_LINKS} YouTube links are allowed.")
        cleaned = []
        for url in v:
            url = url.strip()
            if url and not is_valid_youtube_url(url):
                raise ValueError(f"Not a valid YouTube URL: {url!r}")
            if url:
                cleaned.append(url)
        return cleaned
