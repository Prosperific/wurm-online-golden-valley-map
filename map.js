// Base files copied from http://cadence.yaga.host/
// Then adapted to Golden Valley by Atlas

/* global fabric, Windows */

$('#sw-version').text('2.23   (27-Jul-2022)');  // will be inserted in sidebar

// Make sure some checkboxes are checked/unchecked when loading
$('#layers-deeds').prop('checked', true);
$('#layers-highways').prop('checked', false);
$('#layers-bridges').prop('checked', false);
$('#layers-tunnels').prop('checked', false);
$('#layers-resources').prop('checked', false);
$('#layers-specials').prop('checked', true);
$('#layers-grid').prop('checked', false);
$('#rad-find-deed').prop('checked', true);


var map = (function () {

    //  fabric.Object.prototype.objectCaching = false; // if this line is added it fixes the Firefox memory bug
    //                                                      but line groups are not working
    fabric.perfLimitSizeTotal = 225000000;
    fabric.maxCacheSideLimit = 8192;       // if number too big, zooming in will crash FF
    //
    // Deliverance Map
    // Authors: Substr & Yaga
    // Requires: JQuery, FabricJS (from CDN), FileSaver (https://github.com/eligrey/FileSaver.js),
    //           canvas-toBlob.js (https://github.com/eligrey/canvas-toBlob.js/blob/master/canvas-toBlob.js)

    var Map = function (params) {

        var serverName,
            canvasElement,
            canvas,
            ctx,
            sheetData,
            MAP_WIDTH = 2048,
            MAP_HEIGHT = 2048,
            MIN_ZOOM = 0.5,
            MAX_ZOOM = 10.0,
            GRID_OFFSETX = -10,  // default for Deliverance
            GRID_OFFSETY = -15,  // default for Deliverance
            GRID_SPACING = 102.0, // default for Deliverance
            SCALE_FACTOR = 4.0,
            currentPosition = {'x': 0, 'y': 0},
            selectedPosition = null,
            mapImageURL = 'deliverance-terrain.png',
            mapTopoImageURL = 'deliverance-topo.png',
            clayImage = document.getElementById('img-clay'),
            tarImage = document.getElementById('img-tar'),
            towerImage = document.getElementById('img-tower'),
            specialImage = document.getElementById('img-special'),
            lodestoneImage = document.getElementById('img-lodestone'),
            targetImageURL = 'target.png',
            targetImage,
            screenshotFile = 'DeliveranceMap.png',
            search_mode = 'deed',
            // Info about the sheet data
            rangeDeeds = 'Deeds',
            rangeTunnels = 'Tunnels',
            rangeBridges = 'Bridges',
            rangeResources = 'Resources',
            rangeHighways = 'Highways',
            rangeSpecial = 'Special',
            rangeSystem = 'System',
            linesGroup,
            // Colours
            highwayColour = 'rgba(247,158,43,1)', // Opacity 1 because entire group is given the opacity to avoid line end overlap
            bridgeColour = 'rgba(191,21,202,1)',
            canalColour = '#1076DE',
            //canalColour = '#39426b',
            tunnelColour = '#CC2222',
            canalUnknownColour = 'grey',
            deedFillColour = 'rgba(255,255,0,0.6)',
            deedStrokeColour = 'rgba(0,0,0,0.8)',
            deedMarketStrokeColor = 'rgba(255,0,252,1)',
            deedTextColour = '#fff',
            deedStarterOutlineColour = 'red',
            gridColour = 'rgba(255, 255, 255, 0.5)',
            // Which layers are intially shown?
            showDeeds,
            showHighways,
            showBridges,
            showTunnels,
            showResources,
            showSpecials,
            showGrid,
            deedInfoBox,
            // Converted data
            deeds = [],
            tunnels = [],
            bridges = [],
            resources = [],
            highways = [],
            specials = [],
            grid = [],
            systemInfo = []
        ;



        /***********************************************************************
         * Init the Map
         */
        this.init = async function () {
            
            console.log("domain = " + window.location.hostname);

            serverName = document.title;  // document title = server name (from PHP file)
            console.log("serverName = " + serverName);

            mapImageURL = serverName.toLowerCase() + '-terrain.png';
            mapTopoImageURL = serverName.toLowerCase() + '-topo.png';
            screenshotFile = serverName + 'Map.png';

            if (serverName === "Golden Valley") {
                MAP_WIDTH = 4399;
                MAP_HEIGHT = 4356;
                MIN_ZOOM = 0.25;
                MAX_ZOOM = 4;
            };

            console.log('MAP_WIDTH, MAP_HEIGHT = ' + MAP_WIDTH, MAP_HEIGHT);
            console.log('MIN_ZOOM = ' + MIN_ZOOM);
            console.log('GRID_SPACING = ' + GRID_SPACING);
            console.log('GRID_OFFSET = ' + GRID_OFFSETX, GRID_OFFSETY);


            // Initial visibility of layers
            showDeeds = document.getElementById("layers-deeds").checked;
            showHighways = document.getElementById("layers-highways").checked;
            showBridges = document.getElementById("layers-bridges").checked;
            showTunnels = document.getElementById("layers-tunnels").checked;
            showResources = document.getElementById("layers-resources").checked;
            showSpecials = document.getElementById("layers-specials").checked;
            showGrid = document.getElementById("layers-grid").checked;

            // Create the canvas
            canvasElement = $('canvas');
            canvas = new fabric.Canvas('map', {
                imageSmoothingEnabled: false,
                selection: false,
                allowTouchScrolling: true
            });
            // Set the map image
            fabric.Image.fromURL(mapImageURL, function (oImg) {
                canvas.setBackgroundImage(oImg, canvas.renderAll.bind(canvas));
            });
            linesGroup = new fabric.Group([], {left: 0, top: 0, originX: 'left', originY: 'top', selectable: false, evented: false});
            // Init stuff
            this.initZooming();
            this.initResize();
            $(window).trigger('resize');
            this.initMoving();
            this.showZoomFactor();

            // Fetch data from sheet and then process and draw things
                sheetData = window.sheetData;
            
            this.convertData();
            // Create the canvas objects
            this.drawResources();
            this.drawCanals();
            this.drawBridges();
            this.drawHighways();
            this.drawDeeds();
            this.drawSpecials();
            this.drawGrid();
            this.drawDeedInfo();
            linesGroup.set({'opacity': 0.6});
            canvas.sendToBack(linesGroup);
            // Sidebar controls
            this.toggleLayers();
            this.toggleMap();
            this.toggleSearch();
            this.initCoordinates();
            this.initSearch();
            this.initZoomButtons();
            this.initDeedInfoBox();
            this.initLegendToggle();
            canvas.renderAll();

            $("#loader").remove();
            $('.loading').removeClass('loading');

            // If called with hash string (http://url#x,y)
            // Check if hash string contains valid coordinates
            var hashString = document.location.hash.substring(1);
            var numbers = hashString.split(',');
            var toX = parseInt(numbers[0]);
            var toY = parseInt(numbers[1]);
            console.log('Hash string: x, y = ' + toX, toY);

            if (isNaN(toX) || isNaN(toY))
            {
                this.zoomToLocation(MAP_WIDTH / 2, MAP_HEIGHT / 2, MIN_ZOOM);
            } else if (!isNaN(toX) && (toX > 0) && (toX < MAP_WIDTH))
                if (!isNaN(toY) && (toY > 0) && (toY < MAP_HEIGHT))
                {
                    // if valid coordinates: jump to location
                    this.zoomToLocation(toX, toY, 2);

                    scale = this.scaledImageSize();

                    fabric.Image.fromURL(targetImageURL, function (oImg) {
                        targetImage = oImg;
                        oImg.set({
                            left: toX,
                            top: toY,
                            originX: 'center',
                            originY: 'center',
                            selectable: false,
                            hoverCursor: 'default',
                            scaleX: scale,
                            scaleY: scale
                        });
                        canvas.add(oImg);
                    });

                }

            // Add date of last map update (from "System" sheet)
            $('#last-update').text(systemInfo[0].latestUpdate);  // will be inserted in sidebar
        };

        /***********************************************************************
         * Zooming
         */
        this.initZooming = function () {
            var _self = this;
            var updateTimer = null;
            canvas.on('mouse:wheel', function (opt) {
                clearTimeout(updateTimer);
                var delta = -opt.e.deltaY < 0 ? -100 : 100;

                console.log("Zoom = " + canvas.getZoom());

                if (canvas.getZoom() < 2) {
                    delta = delta / 2;
                }
                if ((canvas.getZoom() < 0.25)) {
                    delta = delta / 2;
                }

                console.log("delta = " + delta);

                var pointer = canvas.getPointer(opt.e);
                var zoom = canvas.getZoom();
                zoom = zoom + delta / 200;
                if (zoom > MAX_ZOOM)
                    zoom = MAX_ZOOM;
                if (zoom < MIN_ZOOM)
                    zoom = MIN_ZOOM;
                
                console.log("zoom = " + zoom);

                canvas.zoomToPoint({x: opt.e.offsetX, y: opt.e.offsetY}, zoom);
                opt.e.preventDefault();
                opt.e.stopPropagation();
                updateTimer = setTimeout(function () {
                    _self.updateSizesAfterZoom();
                }, 10);
            });
        };

        /***********************************************************************
         * Resizing window
         */
        this.initResize = function () {
            $(window).on('resize', function () {
                canvas.setWidth(window.innerWidth);
                canvas.setHeight(window.innerHeight);
            });
        };

        /***********************************************************************
         * Moving map
         */
        this.initMoving = function () {
            canvas.on('mouse:down', function (opt) {
                var evt = opt.e;
                this.isDragging = true;
                this.selection = false;
                var clientX, clientY;
                if (evt.touches) {
                    clientX = evt.touches[0].clientX;
                    clientY = evt.touches[0].clientY;
                } else {
                    clientX = evt.clientX;
                    clientY = evt.clientY;
                }

                this.lastPosX = clientX;
                this.lastPosY = clientY;
            });
            canvas.on('mouse:move', function (opt) {
                if (this.isDragging) {
                    var e = opt.e;
                    var clientX, clientY;
                    if (e.touches) {
                        clientX = e.touches[0].clientX;
                        clientY = e.touches[0].clientY;
                    } else {
                        clientX = e.clientX;
                        clientY = e.clientY;
                    }
                    this.viewportTransform[4] += clientX - this.lastPosX;
                    this.viewportTransform[5] += clientY - this.lastPosY;
                    this.requestRenderAll();
                    this.lastPosX = clientX;
                    this.lastPosY = clientY;
                }
                var pointer = canvas.getPointer(opt.e, false);
                currentPosition = {'x': Math.round(pointer.x), 'y': Math.round(pointer.y)};
            });
            canvas.on('mouse:up', function (opt) {
                this.isDragging = false;
                this.selection = true;
                canvas.forEachObject(function (o) {
                    o.setCoords();
                });
            });
        };

        /***********************************************************************/
        this.scaledFontSize = function () {
            var scaling;
            if (canvas.getZoom() < 2.01)
                scaling = 4;
            else if (canvas.getZoom() > 5)
                scaling = 2;
            else
                scaling = 3;
            var size = 13 - (scaling * canvas.getZoom());
            size = size * SCALE_FACTOR;
            if (size < 4)
                size = 4;
            return size;
        };

        /***********************************************************************/
        this.scaledImageSize = function () {
            var scale = 1;
            var newScale = scale / canvas.getZoom();
            return Math.min(1, newScale);
        };

        /***********************************************************************/
        this.updateSizesAfterZoom = function () {
            var _self = this;
            // Update font sizes
            deedInfoBox.set("fontSize", this.scaledFontSize());

            for (var i in deeds) {
                deeds[i].text.set("fontSize", this.scaledFontSize());
            }
            for (var i in bridges) {
                if (bridges[i].text) {
                    bridges[i].text.set("fontSize", this.scaledFontSize());
                }
            }
            for (var i in tunnels) {
                if (tunnels[i].text) {
                    tunnels[i].text.set("fontSize", this.scaledFontSize());
                }
            }
            for (var i in specials) {
                if (specials[i].text && (specials[i].type === 'MissionStructure')) {
                    specials[i].text.set("fontSize", this.scaledFontSize());
                } else if (specials[i].text && (specials[i].type === 'GuardTowerFreedom')) {
                    specials[i].text.set("fontSize", this.scaledFontSize());
                }

            }

            // Update image scale
            $.each(resources, function (i, l) {
                if (l.image) {
                    l.image.set({
                        scaleX: _self.scaledImageSize(),
                        scaleY: _self.scaledImageSize()
                    });
                }
                if (l.text && l.type === "PointOfInterest") {
                    l.text.set("fontSize", _self.scaledFontSize());
                }
                if (l.text && l.type === "GuardTowerFreedom") {
                    l.text.set("fontSize", _self.scaledFontSize());
                }
            });

            $.each(specials, function (i, l) {
                if (l.image && l.type === "GuardTowerFreedom") {
                    l.image.set({
                        scaleX: _self.scaledImageSize(),
                        scaleY: _self.scaledImageSize()
                    });
                }
            });

            if (targetImage) {
                targetImage.set({
                    scaleX: _self.scaledImageSize(),
                    scaleY: _self.scaledImageSize()
                });
            }

            // Update grid
            $.each(grid, function (i, g) {
                g.set({'strokeWidth': canvas.getZoom() > 1.5 ? 1 : 2});
            });
            this.showZoomFactor();

            // Add resizing to allow higher zooms on FF:
            //$(window).trigger('resize');
            canvas.renderAll();
        };

        /***********************************************************************
         * Convert data to a nicer format
         */
        this.convertData = function () {
            for (var i in sheetData.valueRanges) {
                var range = sheetData.valueRanges[i];

                // Convert the deeds
                if (range.range.includes(rangeDeeds)) {
                    $.each(range.values, function (i, v) {
                        deeds.push({
                            'name': v[0],
                            'x': parseInt(v[1]),
                            'y': parseInt(v[2]),
                            'tags': v[3],
                            'info': v[4]
                        });
                    });
                    
                    // sort deeds alphabetically
                    deeds = deeds.sort((a, b) => {
                        return a.name.localeCompare(b.name);
                        });
                }

                // Convert highways
                else if (range.range.includes(rangeHighways)) {
                    $.each(range.values, function (i, v) {
                        var highway = {
                            'name': v[0],
                            'lines': []
                        };
                        if (v[1].length > 0) {
                            var lineData = JSON.parse(v[1]);
                            $.each(lineData, function (i, l) {
                                if (i < lineData.length - 1) {
                                    highway.lines.push({
                                        x1: parseInt(l[0]),
                                        y1: parseInt(l[1]),
                                        x2: parseInt(lineData[i + 1][0]),
                                        y2: parseInt(lineData[i + 1][1])
                                    });
                                }
                            });
                        }
                        highways.push(highway);
                    });
                }

                // Convert the bridges
                else if (range.range.includes(rangeBridges)) {
                    $.each(range.values, function (i, v) {
                        var bridge = {
                            'name': v[0],
                            'x1': parseInt(v[1]),
                            'y1': parseInt(v[2]),
                            'x2': parseInt(v[3]),
                            'y2': parseInt(v[4])
                        };
                        bridges.push(bridge);
                    });
                }

                // Convert the tunnels
                else if (range.range.includes(rangeTunnels)) {
                    $.each(range.values, function (i, v) {
                        var canal = {
                            'name': v[0],
                            'x1': v[1],
                            'y1': v[2],
                            'x2': v[3],
                            'y2': v[4],
                            'isCanal': v[5] === 'TRUE' ? true : false,
                            'isTunnel': v[6] === 'TRUE' ? true : false,
                            'allBoats': v[7] === 'TRUE' ? true : false
                        };
                        tunnels.push(canal);
                    });
                }

                // Convert the resources
                else if (range.range.includes(rangeResources)) {
                    // "BodyOfWater/PointOfInterest/Clay/Tar/GuardTowerFreedom"
                    $.each(range.values, function (i, v) {
                        var resource = {
                            'name': v[0],
                            'x': parseInt(v[1]),
                            'y': parseInt(v[2]),
                            'type': v[3],
                            'angle': v[4]
                        };
                        resources.push(resource);
                    });
                }

                // Convert special places
                else if (range.range.includes(rangeSpecial)) {
                    // "MissionStructure"
                    $.each(range.values, function (i, v) {
                        var special = {
                            'name': v[0],
                            'x': parseInt(v[1]),
                            'y': parseInt(v[2]),
                            'type': v[3],
                            'tags': v[4]
                        };
                        specials.push(special);
                    });
                    
                    // sort specials alphabetically
                    specials = specials.sort((a, b) => {
                        return a.name.localeCompare(b.name);
                        });

                }

                // Convert system info
                else if (range.range.includes(rangeSystem)) {
                    // "SystemInfo"
                    $.each(range.values, function (i, s) {
                        var info = {
                            'latestUpdate': s[0]
                        };
                        systemInfo.push(info);
                    });
                }

            }
        };

        /***********************************************************************
         * Replace '@' by newline
         */
        this.lineWrap = function (text) {
            var newName = text.replace(/@/g, '\n');
            return newName;
        };

        /***********************************************************************
         * Draw textbox for deed info
         */
        this.drawDeedInfo = function () {
            var _self = this;
            var textbox = new fabric.Textbox('This is where the text goes', {
                left: 0,
                top: 0,
                width: 50,
                height: 10,
                backgroundColor: '#fff',
                hasBorders: true,
                borderColor: '#000',
                fontFamily: 'arial',
                fill: '#000',
                fontSize: _self.scaledFontSize() + 3,
                padding: 2,
                visible: true,
                selectable: false,
                hoverCursor: 'default'
            });
            deedInfoBox = textbox;
        };

        /***********************************************************************
         * Draw deeds
         */
        this.drawDeeds = function () {
            var _self = this;
            var fillColor = deedFillColour;
            var strokeColor = deedStrokeColour;
            $.each(deeds, function (i, d) {
                fillColor = deedFillColour;
                strokeColor = deedStrokeColour;
                if (d.tags && d.tags.includes('MAR')) // Public marketplace
                {
                    fillColor = deedFillColour;
                    strokeColor = deedMarketStrokeColor;
                }

                var squareSide = 13 * SCALE_FACTOR;  // Try to scale deed symbols according to map size

                var rect = new fabric.Rect({
                    left: d.x - 8 * SCALE_FACTOR,
                    top: d.y - 8 * SCALE_FACTOR,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: 2 * SCALE_FACTOR,
                    width: squareSide,
                    height: squareSide,
                    visible: showDeeds,
                    selectable: false,
                    hoverCursor: 'default'
                });
                d.rect = rect;
                if (!(d.tags && d.tags.includes('HID')))   // Don't display if HIDDEN
                {
                    canvas.add(rect);
                }

                if (d.tags && d.tags.includes('STA')) {   // Starter deed
                    var rect2 = new fabric.Rect({
                        left: d.x - 16 * SCALE_FACTOR,
                        top: d.y - 16 * SCALE_FACTOR,
                        stroke: deedStarterOutlineColour,
                        fill: 'transparent',
                        strokeWidth: 2 * SCALE_FACTOR,
                        width: 30 * SCALE_FACTOR,
                        height: 30 * SCALE_FACTOR,
                        visible: showDeeds,
                        selectable: false,
                        hoverCursor: 'default'
                    });
                    d.rect2 = rect2;
                    if (!(d.tags && d.tags.includes('HID')))   // Don't display if HIDDEN
                    {
                        canvas.add(rect2);
                    }

                }

                // Position text label relative to deed symbol:
                var posx = rect.getCenterPoint().x;
                var posy = rect.getCenterPoint().y + 8 * SCALE_FACTOR;
                var originx = 'center';
                var originy = "top";

                if (d.tags && d.tags.includes('TOP')) { // label above symbol
                    posy = rect.getCenterPoint().y - 8 * SCALE_FACTOR;
                    originy = 'bottom';
                } else if (d.tags && d.tags.includes('LEF')) { // label left of symbol
                    posx = rect.getCenterPoint().x - 10 * SCALE_FACTOR;
                    posy = rect.getCenterPoint().y;
                    originx = 'right';
                    originy = 'center';
                } else if (d.tags && d.tags.includes('RIG')) { // label right of symbol
                    posx = rect.getCenterPoint().x + 8 * SCALE_FACTOR;
                    posy = rect.getCenterPoint().y;
                    originx = 'left';
                    originy = 'center';
                }

                var text = new fabric.Text(_self.lineWrap(d.name),
                        {
                            left: posx,
                            top: posy,
                            fontFamily: 'Arial',
                            fontSize: _self.scaledFontSize() + 1,
                            fill: deedTextColour,
                            strokeWidth: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            originX: originx,
                            originY: originy,
                            textAlign: 'center',
                            lineHeight: 0.9,
                            visible: showDeeds,
                            selectable: false,
                            hoverCursor: 'default'
                        }
                );

                if (!(d.tags && d.tags.includes('HID')))   // Don't display if HIDDEN
                {
                    canvas.add(text);
                }

                d.text = text;

            });
        };

        /***********************************************************************
         * Draw resources
         */
        this.drawResources = function () {
            var _self = this;
            $.each(resources, function (i, r) {
                var imageObj;
                if (r.type === 'Clay') {
                    imageObj = clayImage;
                } else if (r.type === 'Tar') {
                    imageObj = tarImage;
                } else if (r.type === 'GuardTowerFreedom') {
                    imageObj = towerImage;
                }

                if (imageObj) {
                    var image = new fabric.Image(imageObj, {
                        left: r.x,
                        top: r.y,
                        originX: 'center',
                        originY: 'center',
                        visible: showResources,
                        selectable: false,
                        hoverCursor: 'default'
                    });
                    r.image = image;
                    canvas.add(image);
                }

                var text;
                if (r.name) {
                    if (r.type === 'GuardTowerFreedom') {
                        var posx = r.x;
                        var posy = r.y + 10;
                        text = new fabric.Text(_self.lineWrap(r.name),
                                {
                                    left: posx,
                                    top: posy,
                                    fontFamily: 'Arial',
                                    fontSize: _self.scaledFontSize(),
                                    fill: deedTextColour,
                                    strokeWidth: 0,
                                    backgroundColor: 'rgba(0,0,0,0.5)',
                                    textAlign: 'center',
                                    lineHeight: 0.9,
                                    originX: 'center',
                                    originY: 'center',
                                    selectable: false,
                                    visible: showResources,
                                    hoverCursor: 'default'
                                }
                        );
                    } else {
                        text = new fabric.Text(_self.lineWrap(r.name),
                                {
                                    left: r.x,
                                    top: r.y,
                                    fontFamily: 'Arial',
                                    fontSize: _self.scaledFontSize(),
                                    fill: '#DDD623',
                                    strokeWidth: 0,
                                    textAlign: 'center',
                                    originX: 'center',
                                    originY: 'center',
                                    selectable: false,
                                    hoverCursor: 'default'
                                }
                        );

                    }
                    if ((r.angle) && (r.angle > 0) && (r.angle < 360))
                    {
                        text.angle = r.angle;
                    }
                    canvas.add(text);
                    r.text = text;
                }
            });
        };

        /***********************************************************************
         * Draw specials
         */
        this.drawSpecials = function () {
            var _self = this;
            $.each(specials, function (i, s) {
                var imageObj;
                if (s.type === 'MissionStructure') {
                    imageObj = specialImage;
                } else if (s.type === 'Lodestone') {
                    imageObj = lodestoneImage;
                } else if (s.type === 'GuardTowerFreedom') {
                    imageObj = towerImage;
                }

                if (imageObj) {
                    var image = new fabric.Image(imageObj, {
                        left: s.x,
                        top: s.y,
                        originX: 'center',
                        originY: 'center',
                        visible: showSpecials,
                        selectable: false,
                        hoverCursor: 'default'
                    });
                    s.image = image;
                    canvas.add(image);
                }

                // Position text label relative to  symbol:
                var posx = s.x;
                var posy = s.y + 6;
                var originx = 'center';
                var originy = "top";

                if (s.tags && s.tags.includes('TOP')) { // label above symbol
                    posy = s.y - 8;
                    originy = 'bottom';
                } else if (s.tags && s.tags.includes('LEF')) { // label left of symbol
                    posx = s.x - 8;
                    posy = s.y;
                    originx = 'right';
                    originy = 'center';
                } else if (s.tags && s.tags.includes('RIG')) { // label right of symbol
                    posx = s.x + 8;
                    posy = s.y;
                    originx = 'left';
                    originy = 'center';
                }

                if (s.name) {
                    if (s.type === 'GuardTowerFreedom') {
                        var text = new fabric.Text(_self.lineWrap(s.name),
                                {
                                    left: posx,
                                    top: posy,
                                    fontFamily: 'Arial',
                                    fontSize: _self.scaledFontSize(),
                                    fill: '#ffff00',
                                    strokeWidth: 0,
                                    originX: originx,
                                    originY: originy,
                                    textAlign: 'center',
                                    lineHeight: 0.9,
                                    visible: showSpecials,
                                    selectable: false,
                                    hoverCursor: 'default'
                                }
                        );
                    } else {
                        var text = new fabric.Text(_self.lineWrap(s.name),
                                {
                                    left: posx,
                                    top: posy,
                                    fontFamily: 'Arial',
                                    fontSize: _self.scaledFontSize(),
                                    fill: '#00fcff',
                                    strokeWidth: 0,
                                    originX: originx,
                                    originY: originy,
                                    textAlign: 'center',
                                    lineHeight: 0.9,
                                    visible: showSpecials,
                                    selectable: false,
                                    hoverCursor: 'default'
                                }
                        );
                    }
                    canvas.add(text);
                    s.text = text;
                }
            });
        };

        /***********************************************************************
         * Draw highways
         */
        this.drawHighways = function () {
            $.each(highways, function (i, h) {
                if (h.lines.length) {
                    h.lineObjects = [];
                    $.each(h.lines, function (z, l) {
                        var line = new fabric.Line([l.x1, l.y1, l.x2, l.y2], {
                            stroke: highwayColour,
                            strokeWidth: 5,
                            strokeLineCap: "round",
                            selectable: false,
                            evented: false,
                            objectCaching: false,
                            originX: 'center',
                            originY: 'center',
                            visible: showHighways
                        });
                        linesGroup.addWithUpdate(line);
                        h.lineObjects.push(line);
                    });
                }
            });
            canvas.add(linesGroup);
        };

        /***********************************************************************
         * Draw bridges
         */
        this.drawBridges = function () {
            var _self = this;
            $.each(bridges, function (i, b) {
                var line = new fabric.Line([b.x1, b.y1, b.x2, b.y2], {
                    stroke: bridgeColour,
                    strokeWidth: 5,
                    strokeLineCap: "round",
                    selectable: false,
                    evented: false,
                    objectCaching: false,
                    originX: 'center',
                    originY: 'center',
                    visible: showBridges
                });
                b.line = line;
                linesGroup.addWithUpdate(line);
                if (b.name) {
                    var text = new fabric.Text(_self.lineWrap(b.name),
                            {
                                left: line.getCenterPoint().x + line.group.left + line.group.width / 2,
                                top: line.getCenterPoint().y + line.group.top + line.group.height / 2,
                                fontFamily: 'Arial',
                                fontSize: _self.scaledFontSize(),
                                fill: '#fff',
                                strokeWidth: 0,
                                originX: 'center',
                                originY: 'center',
                                textAlign: 'center',
                                visible: showBridges,
                                selectable: false,
                                hoverCursor: 'default'
                            }
                    );
                    canvas.add(text);
                    b.text = text;
                }
            });
        };

        /***********************************************************************
         * Draw canals / tunnels
         */
        this.drawCanals = function () {
            var _self = this;
            $.each(tunnels, function (i, c) {
                var lineOpts = {
                    stroke: _self.getCanalColour(c),
                    strokeWidth: 5,
                    selectable: false,
                    evented: false,
                    strokeLineCap: "round",
                    originX: 'center',
                    originY: 'center',
                    visible: showTunnels
                };
                var line = new fabric.Line([c.x1, c.y1, c.x2, c.y2], lineOpts);
                c.line = line;
                linesGroup.addWithUpdate(line);
                if (c.isCanal && c.isTunnel) {
                    lineOpts.strokeDashArray = [10, 20];
                    lineOpts.stroke = tunnelColour;
                    lineOpts.strokeLineCap = "square";
                    var line2 = new fabric.Line([c.x1, c.y1, c.x2, c.y2], lineOpts);
                    c.line2 = line2;
                    linesGroup.addWithUpdate(line2);
                }

                if (c.name) {
                    var text = new fabric.Text(_self.lineWrap(c.name),
                            {
                                left: line.getCenterPoint().x + line.group.left + line.group.width / 2,
                                top: line.getCenterPoint().y + line.group.top + line.group.height / 2,
                                fontFamily: 'Arial',
                                fontSize: _self.scaledFontSize(),
                                fill: '#fff',
                                strokeWidth: 0,
                                originX: 'center',
                                originY: 'center',
                                textAlign: 'center',
                                visible: showTunnels,
                                selectable: false,
                                hoverCursor: 'default'
                            }
                    );
                    canvas.add(text);
                    c.text = text;
                }
            });
        };

        /***********************************************************************/
        this.getCanalColour = function (c) {
            if (c.isCanal && c.isTunnel) {
                return canalColour;
            } else if (c.isCanal) {
                return canalColour;
            } else if (c.isTunnel) {
                return tunnelColour;
            } else {
                return canalUnknownColour;
            }
        };

        /***********************************************************************
         * Draw regions
         */
        this.drawRegions = function () {
            var alpha = 0.06;
            var regionColor = ['rgba(0,0,255,' + alpha + ')',
                'rgba(255,255,0,' + alpha + ')',
                'rgba(0,0,255,' + alpha + ')',
                'rgba(255,255,0,' + alpha + ')',
                'rgba(0,0,255,' + alpha + ')',
                'rgba(255,255,0,' + alpha + ')',
                'rgba(0,0,255,' + alpha + ')',
                'rgba(255,255,0,' + alpha + ')',
                'rgba(0,0,255,' + alpha + ')'];
            var i = 0;

            for (x = 0; x < MAP_WIDTH; x = x + MAP_WIDTH / 3)
            {
                for (y = 0; y < MAP_HEIGHT; y = y + MAP_HEIGHT / 3)
                {
                    var rect = new fabric.Rect({
                        left: x,
                        top: y,
                        fill: regionColor[i],
                        stroke: 'black',
                        strokeWidth: 1,
                        strokeDashArray: [5, 10],
                        width: MAP_WIDTH / 3,
                        height: MAP_HEIGHT / 3,
                        visible: false,
                        selectable: false,
                        hoverCursor: 'default'
                    });
                    i++;
                    canvas.add(rect);
                    grid.push(rect);
                }
            }
        };


        /***********************************************************************
         * Draw grid
         */
        this.drawGrid = function () {
            var _self = this;
            var lineOpts = {
                stroke: gridColour,
                strokeWidth: 2,
                selectable: false,
                evented: false,
                originX: 'center',
                originY: 'center',
                visible: false
            };
            var spacing = GRID_SPACING;
            var letters = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
            // Rows
            for (var i = 0; i < 21; i++) {
                if (i === 0)
                    continue;
               // var line = new fabric.Line([0, (i * spacing) - 15 + GRID_OFFSETY, MAP_WIDTH, (i * spacing) - 15 + GRID_OFFSETY], lineOpts);
                var line = new fabric.Line([0, (i * spacing) + GRID_OFFSETY, MAP_WIDTH, (i * spacing) + GRID_OFFSETY], lineOpts);
                grid.push(line);
                canvas.add(line);
            }
            // Columns
            for (var i = 0; i < 21; i++) {
                if (i === 0)
                    continue;
                //var line = new fabric.Line([(i * spacing) - 10 + GRID_OFFSETX, 0, (i * spacing) - 10 + GRID_OFFSETX, MAP_HEIGHT], lineOpts);
                var line = new fabric.Line([(i * spacing) + GRID_OFFSETX, 0, (i * spacing) + GRID_OFFSETX, MAP_HEIGHT], lineOpts);
                grid.push(line);
                canvas.add(line);
            }
            // Labels
            for (var i = 0; i < 20; i++) {
                for (var j = 0; j < 20; j++) {
                    var text = new fabric.Text(letters[i] + (j + 7),
                            {
                                left: j * spacing + (spacing/2.0) + GRID_OFFSETX,
                                top: i * spacing + (spacing/2.0) + GRID_OFFSETY,
                                fontFamily: 'Arial',
                                fontSize: _self.scaledFontSize() + 20,
                                fill: gridColour,
                                strokeWidth: 0,
                                originX: 'center',
                                originY: 'center',
                                selectable: false,
                                visible: false,
                                hoverCursor: 'default'
                            }
                    );
                    canvas.add(text);
                    grid.push(text);
                }
            }
            _self.drawRegions();
            canvas.renderAll();
        };

        this.fillSearchList = function () {
            var $select = $('#section-search select');

            $select.empty();
            if (search_mode === 'deed') {
                $.each(deeds, function (i, d) {
                    if (!(d.tags && d.tags.includes('HID')))   // Don't display if HIDDEN
                    {

                        $select.append(
                                '<option value="' + i + '">' + d.name.replace(/@/g, ' ') + '</option>'
                                );
                    }
                });
                
            } else {
                $.each(specials, function (i, d) {
                    if (d.name !== "") {
                        if (d.type === 'MissionStructure') {
                            $select.append(
                                    '<option value="' + i + '">' + 'M: ' + d.name.replace(/@/g, ' ') + '</option>'
                                    );
                        }                     }
                });

                $.each(specials, function (i, d) {
                    if (d.name !== "") {
                        if (d.type === 'GuardTowerFreedom') {
                            $select.append(
                                    '<option value="' + i + '">' + 'T: ' + d.name.replace(/@/g, ' ') + '</option>'
                                    );
                        }
                    }
                });
            
            }

        };

        /***********************************************************************
         * Toggle layers
         */
        this.toggleLayers = function () {
            $('#section-layers input[type="checkbox"]').on('click', function (e) {
                var $checkbox = $(this);
                if ($checkbox.attr('id') === 'layers-deeds') {
                    $.each(deeds, function (i, d) {
                        if (d.text) {
                            d.text.set({'visible': $checkbox.is(':checked')});
                        }
                        if (d.rect) {
                            d.rect.set({'visible': $checkbox.is(':checked')});
                        }
                        if (d.rect2) {
                            d.rect2.set({'visible': $checkbox.is(':checked')});
                        }
                    });
                } else if ($checkbox.attr('id') === 'layers-highways') {
                    $.each(highways, function (i, h) {
                        $.each(h.lineObjects, function (j, l) {
                            l.set({'visible': $checkbox.is(':checked')});
                        });
                    });
                } else if ($checkbox.attr('id') === 'layers-bridges') {
                    $.each(bridges, function (i, b) {
                        if (b.text) {
                            b.text.set({'visible': $checkbox.is(':checked')});
                        }
                        if (b.line) {
                            b.line.set({'visible': $checkbox.is(':checked')});
                        }
                    });
                } else if ($checkbox.attr('id') === 'layers-tunnels') {
                    $.each(tunnels, function (i, c) {
                        if (c.text) {
                            c.text.set({'visible': $checkbox.is(':checked')});
                        }
                        if (c.line) {
                            c.line.set({'visible': $checkbox.is(':checked')});
                        }
                        if (c.line2) {
                            c.line2.set({'visible': $checkbox.is(':checked')});
                        }
                    });
                } else if ($checkbox.attr('id') === 'layers-resources') {
                    $.each(resources, function (i, r) {
                        if (r.type === 'Clay' || r.type === 'Tar' || r.type === 'GuardTowerFreedom') {
                            if (r.text) {
                                r.text.set({'visible': $checkbox.is(':checked')});
                            }
                            if (r.image) {
                                r.image.set({'visible': $checkbox.is(':checked')});
                            }
                        }
                    });
                } else if ($checkbox.attr('id') === 'layers-specials') {
                    $.each(specials, function (i, s) {
                        if (s.text) {
                            s.text.set({'visible': $checkbox.is(':checked')});
                        }
                        if (s.image) {
                            s.image.set({'visible': $checkbox.is(':checked')});
                        }

                    });
                } else if ($checkbox.attr('id') === 'layers-grid') {
                    $.each(grid, function (i, g) {
                        g.set({'visible': $checkbox.is(':checked')});
                    });
                }
                canvas.renderAll();
            });

            var _self = this;
            // Keyboard shortcuts
            $(document).on('keypress', function (e) {
                var key = String.fromCharCode(e.which);
                if (key === 'd') {
                    $('#layers-deeds').trigger('click');
                } else if (key === 'h') {
                    $('#layers-highways').trigger('click');
                } else if (key === 'b') {
                    $('#layers-bridges').trigger('click');
                } else if (key === 't') {
                    $('#layers-tunnels').trigger('click');
                } else if (key === 'r') {
                    $('#layers-resources').trigger('click');
                } else if (key === 's') {
                    $('#layers-specials').trigger('click');
                } else if (key === 'g') {
                    $('#layers-grid').trigger('click');
                } else if (key === 'z') {           // Dump map to file
                    // save current viewport and zoom
                    var savedPosition = canvas.getVpCenter();
                    var currentZoom = canvas.getZoom();
                    // enlarge canvas and move viewport to upper left corner of map
                    canvas.setWidth(MAP_WIDTH * currentZoom);
                    canvas.setHeight(MAP_HEIGHT * currentZoom);
                    canvas.renderAll();
                    canvas.absolutePan({x: 0, y: 0});
                    canvas.zoomToPoint({x: 0, y: 0}, currentZoom);
                    _self.updateSizesAfterZoom();

                    _self.saveCanvasToFile();

                    // restore previous viewport
                    canvas.setWidth(window.innerWidth);
                    canvas.setHeight(window.innerHeight);

                    _self.zoomToLocation(savedPosition.x, savedPosition.y, currentZoom);
                }
            });
        };

        /***********************************************************************/
        this.zoomToLocation = function (toX, toY, toZoom) {
            canvas.setZoom(1);
            var vpw = canvas.width;
            var vph = canvas.height;
            var x = (toX - vpw / 2);
            var y = (toY - vph / 2);

            canvas.absolutePan({x: x, y: y});
            canvas.zoomToPoint({x: vpw / 2, y: vph / 2}, toZoom);
            canvas.setZoom(toZoom);

            this.updateSizesAfterZoom();
            this.showZoomFactor();

            currentPosition = {'x': x, 'y': y};
            // Remove focus from text fields (after "find deed"
            $('#section-search select').blur();
        };

        /***********************************************************************/
        this.saveCanvasToFile = function () {
            canvas.getElement().toBlob(function (blob) {
                saveAs(blob, screenshotFile);
            });
        };

        /***********************************************************************
         * Toggle map
         */
        this.toggleMap = function () {
            $('#section-map input[type="radio"]').on('click', function (e) {
                var $radio = $(this);
                var image;
                if ($radio.val() === 'map-type-terrain') {
                    image = mapImageURL;
                } else {
                    image = mapTopoImageURL;
                }
                fabric.Image.fromURL(image, function (oImg) {
                    canvas.setBackgroundImage(oImg, canvas.renderAll.bind(canvas));
                });
            });
        };

        this.toggleSearch = function () {
            _self = this;
            search_mode = 'deed';
            this.fillSearchList();
            var $select = $('#section-search select');

            $('#section-search input[type="radio"]').on('click', function (e) {
                var $radio = $(this);
                $select.empty();
                if ($radio.val() === 'find-type-deed') {
                    search_mode = 'deed';
                } else {
                    search_mode = 'special';

                    $('#layers-specials').prop('checked', false);
                    $('#layers-specials').trigger('click');
                }
                _self.fillSearchList();

            });
        };

        /***********************************************************************
         * Draw Coordinates
         */
        this.initCoordinates = function () {
            var _self = this;
            canvas.on('mouse:move', function (opt) {
                $('#location').text(currentPosition.x + ', ' + currentPosition.y);
            });
            canvas.on('mouse:up', function (opt) {
                if (opt.isClick) {
                    if (opt.target && targetImage && opt.target === targetImage) {
                        canvas.remove(targetImage);
                        document.location.hash = '';
                        return;
                    }

                    var pointer = canvas.getPointer(opt.e, false);
                    selectedPosition = {'x': Math.round(pointer.x), 'y': Math.round(pointer.y)};
                    $('#location-selected input').val(selectedPosition.x + ', ' + selectedPosition.y);
                    if (targetImage) {
                        canvas.remove(targetImage);
                        document.location.hash = '';
                    }
                    scale = _self.scaledImageSize();

                    fabric.Image.fromURL(targetImageURL, function (oImg) {
                        targetImage = oImg;
                        oImg.set({
                            left: selectedPosition.x,
                            top: selectedPosition.y,
                            originX: 'center',
                            originY: 'center',
                            selectable: false,
                            hoverCursor: 'default',
                            scaleX: scale,
                            scaleY: scale
                        });
                        canvas.add(oImg);
                    });

                    document.location.hash = '#' + currentPosition.x + ',' + currentPosition.y;
                }
            });
        };

        /***********************************************************************
         * Deed/special searching
         */
        this.initSearch = function () {
            var _self = this;
            var $select = $('#section-search select');
            search_mode = 'deed';
            $('#find-deed').trigger('click');

            $select.on('change', function (e) {
                if (search_mode === 'deed') {
                    var deed = deeds[$(this).val()];

                    _self.zoomToLocation(deed.rect.left, deed.rect.top, 2);
                } else {
                    var special = specials[$(this).val()];

                    _self.zoomToLocation(special.x, special.y, 2);

                }
            });
        };

        /***********************************************************************
         * Display current zoom factor in sidebar
         */
        this.showZoomFactor = function () {
            $('#section-zoom input').val(canvas.getZoom());
        };

        /***********************************************************************
         * Zoom buttons
         */
        this.initZoomButtons = function () {
            var delta;
            var newZoom;
            var _self = this;
            $('#zoom-in').on('click', function (e) {
                delta = 0.5;

                console.log("Zoom = " + canvas.getZoom());

                if (canvas.getZoom() < 2) {
                    delta = 0.25;
                }
                if ((canvas.getZoom() < 0.25)) {
                    delta = 0.125;
                }

                newZoom = canvas.getZoom() + delta;
                if (newZoom > MAX_ZOOM)
                    newZoom = MAX_ZOOM;
                if (newZoom < MIN_ZOOM)
                    newZoom = MIN_ZOOM;
                canvas.zoomToPoint({x: canvas.width / 2, y: canvas.height / 2}, newZoom);
                _self.updateSizesAfterZoom();
            });

            $('#zoom-out').on('click', function (e) {
                delta = 0.5;

                console.log("Zoom = " + canvas.getZoom());

                if (canvas.getZoom() < 2) {
                    delta = 0.25;
                }
                if ((canvas.getZoom() < 0.25)) {
                    delta = 0.125;
                }

                newZoom = canvas.getZoom() - delta;
                if (newZoom > MAX_ZOOM)
                    newZoom = MAX_ZOOM;
                if (newZoom < MIN_ZOOM)
                    newZoom = MIN_ZOOM;
                canvas.zoomToPoint({x: canvas.width / 2, y: canvas.height / 2}, newZoom);
                _self.updateSizesAfterZoom();
            });
        };

        this.showDeedInfo = function (index) {
            infoText = '';
            if (index > -1) {
                infoText = deeds[index].info;
                x = deeds[index].x + 10;
                y = deeds[index].y - 10;
                console.log(x, y, infoText);
            }
            if ((infoText !== null) && (infoText !== undefined)) {
                deedInfoBox.set({'left': x, 'top': y, 'text': _self.lineWrap(infoText)});
                canvas.add(deedInfoBox);
            }
        };

        this.identifyDeed = function (x, y) {
            index = -1;
            $.each(deeds, function (i, d) {
                if ((d.x === (x + 8 * SCALE_FACTOR)) && (d.y === (y + 8 * SCALE_FACTOR))) {
                    index = i;
                }
            });
            return index;
        };

        this.initDeedInfoBox = function () {
            canvas.on('mouse:over', function (e) {
                if (e.target !== null) {
                    if (e.target.get('fill') === deedFillColour) {
                        e.target.set('fill', 'red');
                        index = _self.identifyDeed(e.target.get('left'), e.target.get('top'));
                        _self.showDeedInfo(index);
                        canvas.renderAll();
                    }
                }
            });

            canvas.on('mouse:out', function (e) {
                if (e.target !== null)
                {
                    if (e.target.get('fill') === 'red') {
                        e.target.set('fill', deedFillColour);
                        canvas.remove(deedInfoBox);
                        canvas.renderAll();
                    }
                }
            });
        };

        this.initLegendToggle = function () {
            $("#legend-btn").on('mouseover', function (e) {
                $("#section-legend").removeClass('hide');
            });

            $("#legend-btn").on('mouseout', function (e) {
                if (!$("#section-legend").hasClass("sticky")) {
                    $("#section-legend").addClass('hide');
                }
            });

            $("#legend-btn").on('click', function (e) {
                $("#section-legend").toggleClass('sticky');
                if (!$("#section-legend").hasClass("sticky")) {
                    $("#section-legend").addClass('hide');
                } else {
                    $("#section-legend").removeClass('hide');
                }
            });

            $("#section-legend").on('mouseout', function (e) {
                if (!$("#section-legend").hasClass("sticky")) {
                    $("#section-legend").addClass('hide');
                }
            });
        };

        this.init();

    };
    return Map;
})();
