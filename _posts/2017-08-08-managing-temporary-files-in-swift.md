---
layout: post
title: Managing Temporary Files in Swift
---

Reference counting is great in taking unused objects out of memory. The same can be applied to the temporary files we allocate.

<!-- more -->

Let’s say you are building a video sharing app, here is what you have to do each time user decides to upload some content
from the app:

- Take a movie and store into a temporary file.

- Present filter/crop/whatever editing UI to the user.

- Render the final video to another temporary file, the first file can be safely removed by now.

- Upload video to the cloud and remove the second file when done.

Taking care of those files manually adds extra complexity and can be easily overseen resulting in an excessive storage
use caused by the lost data. I faced this myself when my pet project suddenly took over all my storage 😂

Reference counting comes to the rescue here: we can create `TemporaryFileURL` class wrapping regular `URL` and performing
cleanup in its deinit method. Now the temporary file will be removed automatically when it becomes unreferenced from
the application.

```swift
public final class TemporaryFileURL: ManagedURL {
    
    public let contentURL: URL
    
    public init(extension ext: String) {
        contentURL = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension(ext)
    }
    
    deinit {
        DispatchQueue.global(qos: .utility).async { [contentURL = self.contentURL] in
            try? FileManager.default.removeItem(at: contentURL)
        }
    }
}
```

Notice the rarely used capture with assignment syntax I used here to pass `contentURL` for the deferred file
cleanup: we’d better not capture `self` during deallocation so we just copy the underlying file URL and let
`self` deallocate properly.

Now you may want to unify all the code working with files no matter if they are normal or temporary. That’s
what `ManagedURL` protocol stands here for. We can conform `URL` struct and/or `NSURL` class to the protocol and pass
`ManagedURL` references all around.

```swift
public protocol ManagedURL {
    var contentURL: URL { get }
    func keepAlive()
}

public extension ManagedURL {
    public func keepAlive() { }
}

extension URL: ManagedURL {
    public var contentURL: URL { return self }
}
```

I have also added a no-op `keepAlive` function whose sole purpose it to allow easy object capture by various closures
used as a completion handlers. This allows us to keep file while background operation is executed like this:

```swift
URLSession.shared.uploadTask(with: request, fromFile: fileToUpload.contentURL) { _, _, _ in
    temporaryFile.keepAlive()
}
```

As [James Richard](https://twitter.com/ketzusaka) reminded on Twitter, this technique is called
[Resource Acquisition is Initialization](https://en.wikipedia.org/wiki/Resource_acquisition_is_initialization),
or RAII, and has beed commonly used in C++ for ages. The trick is good for managing lifetime of any external
resource but is often overlooked since destructors are not very common in the modern world of ARC, GC, defer,
try/finally and others.