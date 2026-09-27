/**
 * Lighthouse CI: the pages it measures and the limits they must meet.
 *
 * A script rather than JSON so the blog's pages are measured only once the
 * blog is out. While it is hidden (web/src/blog-public.mjs) its pages are
 * noindex on purpose, and Lighthouse would fail them for it.
 */
const fs = require('node:fs');
const path = require('node:path');

const blogPublic = /BLOG_PUBLIC\s*=\s*true/.test(
  fs.readFileSync(path.join(__dirname, 'web', 'src', 'blog-public.mjs'), 'utf8'));

const urls = [
  "http://localhost/",
  "http://localhost/download/",
  "http://localhost/studio/",
  "http://localhost/colouring/",
  "http://localhost/playground/",
  ...(blogPublic ? [
    "http://localhost/blog/",
    "http://localhost/blog/screen-time-three-year-old/",
  ] : [])
];

module.exports = {
  "ci": {
    "collect": {
      "staticDistDir": "./docs",
      "url": urls,
      "numberOfRuns": 3,
      "settings": {
        "onlyCategories": [
          "performance",
          "accessibility",
          "best-practices",
          "seo"
        ],
        "blockedUrlPatterns": [
          "*googletagmanager.com*",
          "*google-analytics.com*"
        ]
      }
    },
    "assert": {
      "assertions": {
        "categories:performance": [
          "error",
          {
            "minScore": 0.85,
            "aggregationMethod": "median-run"
          }
        ],
        "categories:accessibility": [
          "error",
          {
            "minScore": 0.9
          }
        ],
        "categories:seo": [
          "error",
          {
            "minScore": 0.9
          }
        ],
        "categories:best-practices": [
          "warn",
          {
            "minScore": 0.9
          }
        ],
        "modern-image-formats": [
          "error",
          {
            "maxLength": 0
          }
        ],
        "uses-optimized-images": [
          "error",
          {
            "maxLength": 0
          }
        ],
        "efficient-animated-content": [
          "error",
          {
            "maxLength": 0
          }
        ],
        "unsized-images": [
          "error",
          {
            "maxLength": 0
          }
        ],
        "uses-responsive-images": [
          "warn",
          {
            "maxLength": 0
          }
        ],
        "total-byte-weight": [
          "error",
          {
            "maxNumericValue": 1000000
          }
        ],
        "largest-contentful-paint": [
          "warn",
          {
            "maxNumericValue": 4000,
            "aggregationMethod": "median-run"
          }
        ],
        "cumulative-layout-shift": [
          "error",
          {
            "maxNumericValue": 0.1
          }
        ]
      }
    },
    "upload": {
      "target": "filesystem",
      "outputDir": ".lighthouseci"
    }
  }
};
