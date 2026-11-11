import { describe, expect, it } from "vitest";
import { videoEmbedUrl } from "./video";

describe("video links", () => {
  it("YouTube and Vimeo links become embeddable players", () => {
    expect(videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbedUrl("https://m.youtube.com/shorts/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbedUrl("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789");
    expect(videoEmbedUrl("https://vimeo.com/123456789/abcdef1234")).toBe("https://player.vimeo.com/video/123456789?h=abcdef1234");
  });
  it("anything else is refused", () => {
    expect(videoEmbedUrl("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(videoEmbedUrl("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(videoEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(videoEmbedUrl("")).toBeNull();
  });
});
