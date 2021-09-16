document.querySelectorAll('pre.highlight').forEach(function (codeBlock) {
  var copyButton = document.createElement('button');
  copyButton.className = 'copy-code btn btn-outline-secondary';
  copyButton.type = 'button';
  copyButton.ariaLabel = 'Copy code to clipboard';
  copyButton.innerText = 'Copy';
  codeBlock.append(copyButton);

  copyButton.addEventListener('click', function () {
    var code = codeBlock.querySelector('code').innerText;
    window.navigator.clipboard.writeText(code);

    copyButton.innerText = 'Copied';
    setTimeout(function () {
      copyButton.innerText = 'Copy';
    }, 4000);
  });
});
