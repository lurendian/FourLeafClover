/*: 

 * @plugindesc This plugin automatically changes the resolution of the game to the screen size of the device used. 

 * @author KYDSGAME

 * 

 * @help 

 * To use this plugin, just place it in the js/plugins folder and enable it in the Plugin Manager. 

 * This plugin will detect the screen size of the device used and adjust the game resolution accordingly. 

 * This plugin will also resize the game window to fit the screen size if the game is played on a browser. 

 * This plugin will work with any resolution, but it is recommended to use a 16:9 aspect ratio for the best results. 

 * This plugin will also scale the graphics and fonts to match the resolution, so you don't need to worry about them being too small or too big. 

 * This plugin will not affect the save files, so you can switch devices without any problems. 

 * This plugin will also work with other plugins that change the resolution, such as MUSH: Screen Resolution Menu Option[^1^][2]. 

 * However, if you use multiple plugins that change the resolution, make sure to place this plugin below them in the Plugin Manager. 

 */ 

 

(function() { 

 

  var parameters = PluginManager.parameters('ResolutionChanger'); 

  var _SceneManager_initGraphics = SceneManager.initGraphics; 

  SceneManager.initGraphics = function() { 

    _SceneManager_initGraphics.call(this); 

    this.changeResolution(); // Call the function to change the resolution 

  }; 

 

  SceneManager.changeResolution = function() { 

    var screenWidth = window.screen.width; // Get the screen width of the device 

    var screenHeight = window.screen.height; // Get the screen height of the device 

    var gameWidth = screenWidth; // Set the game width to the screen width 

    var gameHeight = screenHeight; // Set the game height to the screen height 

    var windowWidth = screenWidth; // Set the window width to the screen width 

    var windowHeight = screenHeight; // Set the window height to the screen height 

    var scale = 1; // Set the scale factor to 1 

    if (Utils.isMobileDevice()) { // If the device is mobile 

      if (screenWidth < screenHeight) { // If the device is in portrait mode 

        gameWidth = screenHeight; // Swap the game width and height 

        gameHeight = screenWidth; 

        windowWidth = screenHeight; // Swap the window width and height 

        windowHeight = screenWidth; 

      } 

      scale = window.devicePixelRatio || 1; // Get the device pixel ratio 

    } 

    gameWidth *= scale; // Multiply the game width by the scale factor 

    gameHeight *= scale; // Multiply the game height by the scale factor 

    windowWidth *= scale; // Multiply the window width by the scale factor 

    windowHeight *= scale; // Multiply the window height by the scale factor 

    Graphics.boxWidth = gameWidth; // Set the box width of the graphics 

    Graphics.boxHeight = gameHeight; // Set the box height of the graphics 

    Graphics._width = gameWidth; // Set the width of the graphics 

    Graphics._height = gameHeight; // Set the height of the graphics 

    Graphics._renderer.resize(gameWidth, gameHeight); // Resize the renderer 

    Graphics._canvas.width = gameWidth; // Set the canvas width 

    Graphics._canvas.height = gameHeight; // Set the canvas height 

    Graphics._centerElement(Graphics._canvas); // Center the canvas element 

    Graphics._updateAllElements(); // Update all the graphics elements 

    window.resizeTo(windowWidth, windowHeight); // Resize the window to fit the screen size 

    window.moveTo((screenWidth - windowWidth) / 2, (screenHeight - windowHeight) / 2); // Move the window to the center of the screen 

  }; 

 

})(); 