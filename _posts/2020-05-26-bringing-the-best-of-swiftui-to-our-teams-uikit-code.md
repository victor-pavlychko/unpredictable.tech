---
layout: post
title: Bringing the Best of SwiftUI to Our Team’s UIKit Code
external_name: Grammarly Engineering Blog
external_url: https://www.grammarly.com/blog/engineering/swiftui-uikit/
---

Like pretty much all our colleagues in the field, iOS developers at Grammarly are excited about SwiftUI. Released at the 2019
Apple Worldwide Developers Conference (WWDC), it represents a major step forward in Apple’s support for building great user
experiences. But as much as we want to use SwiftUI for everything, we can’t. For one thing, the libraries are still new and will
probably take a few years to completely stabilize. Plus, SwiftUI is only bundled in iOS 13+, and we need to continue to support 
Grammarly for older versions of iOS. And finally, our existing UIKit code represents a huge, years-long investment for our
team—we don’t want to just throw it out. 
