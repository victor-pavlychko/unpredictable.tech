---
layout: post
title: DRY String Localization with Interface Builder
---

Great applications should have great localization. And users will appreciate an option to use beloved apps
in their native language. There is no excuse for developers not to support interface localization even on
early stages of the development process, especially when it’s so easy to do.

I prefer to design mostly with the Interface Builder. In this article I would like to share an approach
I use in my projects to localize those resources.

<!-- more -->

Normally, when you try to localize a XIB file or storyboard, Xcode will happily clone the resource and you
get stuck with duplicated view layouts. Yuck… That’s hardly a good option if you are trying to follow
the DRY methodology 😕

Instead of doing that I suggest filling "at"-prefixed localization terms in the Interface Builder and
replacing them with the localized values in `viewDidLoad` or `awakeFromNib` methods of the corresponding objects.
Here is an example of how it looks like in the Interface Builder:

I use `@` prefix for localization terms to allow mixing them with any real values as needed. Additionally,
leading `@@` sequence is replaced with a single `@` in case you need to specify unlocalized string starting
with the "at" symbol.

As it usually happens in Swift, we start with a protocol:

```swift
public protocol Localizable {
    func localize()
}
```

Followed by an extension containing some helpers to localize strings and apply localized values to properties:

```swift

public extension Localizable {
    
    public func localize(_ string: String?) -> String? {
        guard let term = string, term.hasPrefix("@") else {
            return string
        }
        guard !term.hasPrefix("@@") else {
            return term.substring(from: term.index(after: term.startIndex))
        }
        return NSLocalizedString(term.substring(from: term.index(after: term.startIndex)), comment: "")
    }
    
    public func localize(_ string: String?, _ setter: (String?) -> Void) {
        setter(localize(string))
    }

    public func localize(_ getter: (UIControlState) -> String?, _ setter: (String?, UIControlState) -> Void) {
        setter(localize(getter(.normal)), .normal)
        setter(localize(getter(.selected)), .selected)
        setter(localize(getter(.highlighted)), .highlighted)
        setter(localize(getter(.disabled)), .disabled)
    }
}
```

> **Note:** `substring` API is deprecated in Swift 4, should be replaced with `dropFirst` which also describes
the original intent better.

> **Note:** second localization helper should be upgraded to use the new KeyPath syntax when moving
to Swift 4.

Ok, so far, so good. Now let’s start implementing some localization. The process itself is clearly recursive
where each container asks its children to localize themselves:

```swift
extension UIView: Localizable {
    public func localize() {
        subviews.forEach { $0.localize() }
    }
}
```

Having implemented that, let’s add localization support for common controls required in most applications.
The implementation is straightforward:

```swift
public extension UILabel {
    public override func localize() {
        super.localize()
        localize(text) { text = $0 }
    }
}

public extension UIButton {
    public override func localize() {
        super.localize()
        localize(title(for:), setTitle(_:for:))
    }
}
```

Notice that for `UIButton` title we use another helper function which applies localization for all
possible control states.

Views are not the only objects we can configure with the Interface Builder. We should keep in mind
the following objects too:

- `UIBarItem` with it’s subclasses: `UIBarButtonItem` and `UITabBarItem`

- `UINavigationItem`

Any other objects you decide to use in your app

```swift
extension UIBarItem: Localizable {
    public func localize() {
        localize(title) { title = $0 }
    }
}

public extension UIBarButtonItem {
    public override func localize() {
        super.localize()
        customView?.localize()
    }
}

extension UINavigationItem: Localizable {
    public func localize() {
        localize(title) { title = $0 }
        localize(prompt) { prompt = $0 }
        titleView?.localize()
        leftBarButtonItems?.forEach { $0.localize() }
        rightBarButtonItems?.forEach { $0.localize() }
    }
}
```

Finally, we have to start the flow somewhere. I usually rely on the following events:

- Localize `title`, `navigationItem`, `tabBarItem` and `view` in the `viewDidLoad` method of
my `UIViewController` subclasses.

- Localize contents of `UITableViewCell` and `UICollectionViewCell` subclasses in the
corresponding `awakeFromNib` methods.

For the `UIViewController` here is a helper method to localize content, navigation and tab items:

```swift
extension UIViewController: Localizable {
    public func localize() {
        localize(title) { title = $0 }
        navigationItem.localize()
        tabBarItem?.localize()
        view.localize()
    }
}
```
