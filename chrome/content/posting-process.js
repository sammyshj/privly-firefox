/**
 * @namespace
 * Handles posting process, whereby the user generates a new Privly link for
 * addition to the host page's form. The process is as follows:
 * 1. The user opens a context menu by right-clicking on a form element
 * 2. The user selects a posting application from the context menu
 * 3. The extension opens the posting application in the bottom of the chrome
 *    window.
 * 4. The user completes interaction with the chrome window and it fires
 *    a PrivlyUrlEvent, containing the URL of the generated content.
 * 5. The extension places the event's URL into the host page's form, and
 *    closes the posting application's window.
 */
var privlyExtensionPosting = {
  
  /**
   * Interface object to the extension preferences.
   */
  preferences: Components.classes["@mozilla.org/preferences-service;1"]
                         .getService(Components.interfaces.nsIPrefService)
                         .getBranch("extensions.privly."),
  
  /**
   * Variable used during a posting transaction to save where the 
   * resulting URL will be pasted to.
   */
  currentTargetNode: undefined,
  
  /**
   * Variable used during posting transaction to save which tab
   * contains the currentTargetNode.
   */
  tabReceivingPost: undefined,
  
  /**
   * This is the value of the form element being passed into 
   * the posting application.
   */
  postingApplicationMessage: "",
  
  /**
   * Indicates which user interface element opened the posting application.
   * Values include: 
   * "keyboard" the keyboard shortcut opened the posting application.
   * "contextmenu" the context menu opened the posting application.
   */
  interactionType: "",
  
  /**
   * Start the posting process from a keyboard shortcut. The active element
   * (where the user focused) must be a form element. The extension
   * will message the posting application the current value of the form
   * element, as well as a message indicating the posting process resulted from
   * a keyboard shortcut.
   *
   * @param postingApplicationPath string the path to the posting application
   * being used to generate the post. Example values are '/zero_bin/' and
   * '/posts/plain_post/'
   *
   */
  keyboardPost: function (postingApplicationPath) {
    
    privlyExtensionPosting.interactionType = "keyboard";
    
    var nodeName = gBrowser.contentDocument.activeElement.nodeName;
    
    if ( nodeName !== "INPUT" && nodeName !== "TEXTAREA" ) {
      alert("The Privly keyboard shortcut only works for standard " + 
            "forms. If you want us to make it work here, report a bug at: " + 
            "http://www.privly.org/content/bug-report");
    } else {
      privlyExtensionPosting.tabReceivingPost = gBrowser.selectedTab;
      privlyExtensionPosting.currentTargetNode = gBrowser.contentDocument.activeElement;
      privlyExtensionPosting.postingApplicationMessage = 
        privlyExtensionPosting.currentTargetNode.value;
      privlyExtensionPosting.openPostingApplication(postingApplicationPath);
    }
  },
  
  /**
   * Start the posting process from the context menu. The active element
   * (where the user focused) must be a form element. The extension
   * will message the posting application the current value of the form
   * element.
   *
   * @param postingApplicationPath string the path to the posting application
   * being used to generate the post. Example values are '/zero_bin/' and
   * '/posts/plain_post/'
   *
   */
  contextmenuPost: function (postingApplicationPath) {
    privlyExtensionPosting.interactionType = "contextmenu";
    privlyExtensionPosting.tabReceivingPost = gBrowser.selectedTab;
    privlyExtensionPosting.currentTargetNode = document.popupNode;
    privlyExtensionPosting.postingApplicationMessage = 
      privlyExtensionPosting.currentTargetNode.value;
    privlyExtensionPosting.openPostingApplication(postingApplicationPath);
  },
  
  /**
   * This callback is executed when a posting application sends a secret
   * identifier to the extension to open the communication channel.
   *
   * @param secretMessage string The secret message string.
   *
   * @see privlyExtensionPosting.openPostingApplication
   *
   */
  handleMessageSecretEvent: function (secretMessage) {
    
    "use strict";
    
    if ( privlyExtensionPosting.postingApplicationMessage !== undefined &&
         privlyExtensionPosting.postingApplicationMessage !== "" ) {
           
      var contentServerUrl = this.preferences.getCharPref("contentServerUrl");
      var postingDocument = document.getElementById('post-iframe').contentWindow;
      
      //deprectated
      postingDocument.postMessage(secretMessage + "InitialContent" +
        privlyExtensionPosting.postingApplicationMessage, contentServerUrl);
      
      // privly-applications posting method
      var message = JSON.stringify({secret: secretMessage,
                        handler: "messageSecret"});
      postingDocument.postMessage(message, contentServerUrl);
      
      if ( privlyExtensionPosting.interactionType === "keyboard" ) {
        postingDocument.postMessage(secretMessage + "Submit" +
          privlyExtensionPosting.postingApplicationMessage, contentServerUrl);
      }
    }
  },
  
  /** 
   * Opens posting application in the 'chrome' of the browser.
   * This function opens an iframe from the current content server
   * for the user to type their content into.
   *
   * @param postingApplication string A string that will be added to the
   * currently selected content server's URL. Currently supported values
   * are /zero_bin/ and /posts/plain_post, but the string could potentially be
   * anything.
   *
   * @see privlyExtensionPosting.handleUrlEvent
   *
   * @see privlyExtensionPosting.closePostingApplication
   */
  openPostingApplication: function (postingApplication) {
    
    "use strict";
    
    //Open the form from the selected content server
    var contentServerUrl = this.preferences.getCharPref("contentServerUrl");
    document.getElementById('post-iframe').setAttribute("src", 
      contentServerUrl + postingApplication);
    
    //display the form elements in the bottom of the browser chrome
    document.getElementById('post-splitter').hidden = false;
    document.getElementById('post-iframe-vbox').hidden = false;
    document.getElementById('post-cancel-button').hidden = false;
  },
  
  /** 
   * Closes posting application in the 'chrome' of the browser.
   * This function closes the iframe that generates new Privly content.
   *
   * @see privlyExtensionPosting.handleUrlEvent
   *
   */
  closePostingApplication: function (postingApplication) {
    
    "use strict";
    
    privlyExtensionPosting.postingApplicationMessage = undefined;
    privlyExtensionPosting.tabReceivingPost = undefined;
    privlyExtensionPosting.currentTargetNode = undefined;
    privlyExtensionPosting.interactionType = "";
    
    document.getElementById('post-splitter').hidden = true;
    document.getElementById('post-iframe-vbox').hidden = true;
    document.getElementById('post-cancel-button').hidden = true;
    document.getElementById('post-iframe').setAttribute("src", "");
  },
  
  /**
   * Receive URL to encrypted post for posting to selected form element.
   * This function also closes the posting iframe and changes its source
   * so it no longer contains the content.
   * 
   * @param {string} url The URL to be added to the host page.
   */
  handleUrlEvent: function(url) {
    
    //Switch to the tab initiating the post
    gBrowser.selectedTab = privlyExtensionPosting.tabReceivingPost;
    
    // Focus the DOM Node, then fire keydown and keypress events
    privlyExtensionPosting.currentTargetNode.focus();
    var keydownEvent = document.createEvent("KeyboardEvent"); 
    keydownEvent.initKeyEvent('keydown', true, true, window, 0, 
                            false, 0, false, 0, 0); 
    privlyExtensionPosting.currentTargetNode.dispatchEvent(keydownEvent);
    var keypressEvent = document.createEvent("KeyboardEvent");
    keypressEvent.initKeyEvent('keypress', true, true, window, 0, 
                            false, 0, false, 0, 0); 
    privlyExtensionPosting.currentTargetNode.dispatchEvent(keypressEvent);
    
    // Some sites need time to execute form initialization 
    // callbacks following focus and keydown events.
    // One example includes Facebook.com's wall update
    // form and message page.
    setTimeout(function(){
      
      privlyExtensionPosting.currentTargetNode.value = url;
      privlyExtensionPosting.currentTargetNode.textContent = url;
      
      var event = document.createEvent("KeyboardEvent"); 
      event.initKeyEvent('keyup', true, true, window, 
                              0, false, 0, false, 0, 0); 
      privlyExtensionPosting.currentTargetNode.dispatchEvent(event);
      privlyExtensionPosting.closePostingApplication();
    },500);
  },
  
  /** 
   * This is a helper method for determining whether a DOM node is editable.
   * We only want to post into form, or editable elements.
   *
   * @param {DOM node} node The node for which we want to know if
   * it is editable.
   *
   * @return {boolean} Indicates whether the node is editable.
   *
   */
  isEditable: function(node) {
    
    "use strict";
    
    if ( node.contentEditable === "true" ) {
      return true;
    } else if ( node.contentEditable === "inherit" ) {
      //support for the Closure library
      if ( node.getAttribute("g_editable") === "true" ) {
        return true;
      } else if ( node.parentNode !== undefined && node.parentNode !== null ) {
        return privly.isEditable(node.parentNode);
      } else {
        return false;
      }
    } else {
      return false;
    }
  },
  
  /**
   * Determines which menu options are shown in the right-click menu.
   *
   * @param {event} evt A right click event.
   *
   */
  checkContextForPrivly: function (evt) {
    
    "use strict";
    
    var publicPostToPrivlyMenuItem = document.getElementById('publicPostToPrivlyMenuItem');
    var encryptedPostToPrivlyMenuItem = document.getElementById('encryptedPostToPrivlyMenuItem');
    var postingMenuSeparator = document.getElementById('postingMenuSeparator');
    
    publicPostToPrivlyMenuItem.hidden = true;
    encryptedPostToPrivlyMenuItem.hidden = true;
    postingMenuSeparator.hidden = true;
    
    var postable = false;
    if (evt.target.nodeName !== null) {
      if (evt.target.nodeName.toLowerCase() === 'input' ||
        evt.target.nodeName.toLowerCase() === 'textarea') {
          postable = true;
      }
    }
    if (!postable && privlyExtensionPosting.isEditable(evt.target)) {
      postable = true;
    }
    
    if ( postable ) {
      encryptedPostToPrivlyMenuItem.hidden = false;
      publicPostToPrivlyMenuItem.hidden = false;
      postingMenuSeparator.hidden = false;
    }
  }
};

/**
 * Modify the context menu (right click menu) according to the page element
 * the user clicks.
 */
window.addEventListener("contextmenu",
  function (e) {
    "use strict";
    privlyExtensionPosting.checkContextForPrivly(e);
  },
  false);

/**
 * Watch for encrypted URLs sent by the encryption iframe. These URLs are
 * generated whent the user completes the posting process.
 */
window.addEventListener("load", function load(event){
    
    document.getElementById('post-iframe')
      .addEventListener("PrivlyMessageEvent", 
        function(e) {
          var data = JSON.parse(e.target.getAttribute("data-message-body"));
          if (data.handler === "messageSecret") {
            privlyExtensionPosting.handleMessageSecretEvent(data.data);
          } else if(data.handler === "privlyUrl") {
            privlyExtensionPosting.handleUrlEvent(data.data);
          }
        }, false, true);
    
    //decprecated messagers
    document.getElementById('post-iframe')
      .addEventListener("PrivlyUrlEvent", 
        function(e) { 
          var url = e.target.getAttribute("privlyUrl");
          privlyExtensionPosting.handleUrlEvent(url); 
        }, false, true);
    document.getElementById('post-iframe')
      .addEventListener("PrivlyMessageSecretEvent", 
        function(e) { 
          privlyExtensionPosting.handleMessageSecretEvent(e); }, false, true);
  },false);
