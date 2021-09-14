---
layout: post
title: Storyboard Tricks
---

While looking through another sample project today, I have once again noticed how many string literals and force downcasts accompany most of the storyboard-related code.

Having realized that, I decided to share a few practices I use myself to make my view controller and storyboard handling code more conscious.

<!-- more -->

## Instantiating View Controllers

Let’s start with the instantiation process: we rely on file name to create `UIStoryboard`
instance, then we use view controller identifier to call `instantiateViewController(withIdentifier:)`
and all this mess is followed by the force downcast to the actual type.

View controller instantiation code should be much cleaner, here is an example of what I’m looking for:

```swift
private func presentDetails(for item: ItemModel) {
    let viewController = DetailsViewController.makeWithStoryboard()
    viewController.delegate = self
    viewController.model = item
    present(viewController, animated: true, completion: nil)
}
```

To achieve that we have to avoid "massive storyboard" pattern and keep each flow in a separate file.
Having done that we can establish simple conventions allowing us to hide all that UIStoryboard stuff
in a helper function:

- Only instantiate initial view controllers from code.

- Access all other view controllers in the same storyboard via segues.

- Use initial view controller class name to name the corresponding storyboard.
This is obvious for good old NIBs but we tend to not use the pattern with storyboards.

After establishing the conventions we can easily instantiate any view controller given only its class,
everything else is derived programmatically. Helper function code should be something similar to the
following snippet:

```swift

private func dynamicCast<T>(_ object: Any, as: T.Type) -> T? {
    return object as? T
}

public extension UIViewController {
    public static func makeWithStoryboard(_ name: String? = nil, bundle: Bundle? = nil) -> Self {
        let name = name ?? String(describing: self).components(separatedBy: ".").last!
        let bundle = bundle ?? Bundle(for: self)
        guard bundle.url(forResource: name, withExtension: "storyboardc") != nil else {
            fatalError("Can't find storyboard named `\(name)` in bundle `\(bundle)`.")
        }
        let storyboard = UIStoryboard(name: name, bundle: bundle)
        guard let initialViewController = storyboard.instantiateInitialViewController() else {
            fatalError("No initial view controller defined in storyboard `\(name)`, bundle `\(bundle)`.")
        }
        guard let resultViewController = dynamicCast(initialViewController, as: self) else {
            fatalError("Wrong initial view controller found in storyboard `\(name)`, bundle `\(bundle)`: expected `\(self)`, found `\(type(of: initialViewController))`.")
        }
        return resultViewController
    }
}
```

I’d like to note two tricky moments here:

- We use `Bundle(for: self)` instead of `nil` or `Bundle.main` to properly load resources from dynamic frameworks.

- That weird `dynamicCast(_:as:)` function helps us to work around Swift limitation which prohibits us to
write `initialViewController as? Self`. Doing the former results in a compile error stating that "`Self` is
only available in a protocol or as the result of a method in a class".

## Handling Segues

Another popular place to find string identifiers when working with storyboards is `prepare(for:sender:)` method.
Here we test segue identifier and downcast view controller depending on that. Something like this:

```swift
override func prepare(for segue: UIStoryboardSegue, sender: Any?) {
    if segue.identifier == "OpenAnotherViewController" {
        let destination = segue.destination as! AnotherViewController
        destination.delegate = self
        return
    }
}
```

The snippet employs two bad practices at once: error-prone string identifier comparison followed by force downcast.

It seems to me that the only thing that actually matters in most cases is our destination view controller type.
In those cases we can simply switch over the possible destinations and `fatalError` for everything else. The following
code snippet shows how this may look in your code:

```swift

override func prepare(for segue: UIStoryboardSegue, sender: Any?) {
    switch segue.destination {
    case let destination as AnotherViewController:
        destination.delegate = self
    default:
        fatalError("Unexpected segue: `\(self)` -> `\(segue.destination)`")
    }
}
```
