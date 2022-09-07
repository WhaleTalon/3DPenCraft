import * as THREE from 'three';
import { OrbitControls } from 'three/controls/OrbitControls';
import { TransformControls } from 'three/controls/TransformControls'
import { FontLoader } from 'three/loaders/FontLoader';
import { TextGeometry } from 'three/geometries/TextGeometry';
import Stats from 'three/libs/stats.module';
import {GUI} from 'dat.gui';
import { LoadingProcess } from './processes/LoadingProcess.js';
import { PreProcessorProcess } from './processes/PreProcessorProcess.js';
import { SearchProcess } from './processes/SearchProcess.js';
import { CurveIntrapolationProcess } from './processes/CurveIntrapolationProcess.js';
import { SimulationProcess } from './processes/SimulationProcess.js';


// Hex color values used by UI
const colorValues = {
    FG_COLOR: "#ea7340",
    BG_COLOR: "#3b6ccd",
    FOCUS_TEXT_COLOR: "#007722",
    NORMAL_TEXT_COLOR: "#ec9775"
}

// typical three.js variables
let camera, scene, fullScreenScene, renderer, canvas;
let stats, orbitControls, transformControls;
let aLight, aSpotLight;
let rayCaster, mouseDownPosition, mouseUpPosition;
let gui;

// Used to add simulation animation in fullscreen mode to the scene
let simulationObject;

// Variables to manage animation timing
const clock = new THREE.Clock( false );
let timing = {speed: 1/30, currentLength: 0};

// Variables needed to manage requestIdleCallback() queue
let nextProcessQueueID = null;
let nextProcessToRun = null;
let nextProcessToRunData = null;

// Instantiating processes
let loadingProcess = new LoadingProcess( onProcessCompleted, onProcessError );
let preProcessorProcess = new PreProcessorProcess( onProcessCompleted, onProcessError );
let searchProcess = new SearchProcess( onProcessCompleted, onProcessError );
let curveIntrapolationProcess = new CurveIntrapolationProcess( onProcessCompleted, onProcessError );
let simulationProcess = new SimulationProcess( onProcessCompleted, onProcessError );

const processArray = [ loadingProcess, preProcessorProcess, searchProcess, curveIntrapolationProcess, simulationProcess ];

// State variables
let state = loadingProcess.processName;
let fullScreenMode = false;

init();   

// Core functions & housekeeping
function init() {

    // Camera
    camera = new THREE.PerspectiveCamera( 45, window.innerWidth/window.innerHeight, 0.1, 20 );
    camera.position.set( 0, 0, .9 );
    camera.lookAt( new THREE.Vector3() );

    // Scene 
    scene = new THREE.Scene();
    scene.background = new THREE.Color( colorValues.BG_COLOR );

    // Fullscreen Scene
    fullScreenScene = new THREE.Scene();
    fullScreenScene.background = new THREE.Color( colorValues.BG_COLOR );

    // Target for the simulation in full screen mode
    simulationObject = new THREE.Object3D();
    simulationObject.position.set( -0.9, .435, 0);
    simulationObject.scale.set( 3, 3, 3 );
    fullScreenScene.add( simulationObject );

    // Initialize processes
    loadingProcess.setPosition( -.5, .2, 0 );
    loadingProcess.heading = "Source object";
    loadingProcess.headingPosition.set( -.5, .05, 0 );

    preProcessorProcess.setPosition( -.1, .2, 0 );
    preProcessorProcess.heading = "Pre-processed\n    Geometry";
    preProcessorProcess.headingPosition.set( -.1, .0268, 0 );

    searchProcess.setPosition( .3, .2, 0 );
    searchProcess.heading = "Search result";
    searchProcess.headingPosition.set( .3, .05, 0 );

    curveIntrapolationProcess.setPosition( -.5, -.14, 0 );
    curveIntrapolationProcess.heading = "Extracted curves";
    curveIntrapolationProcess.headingPosition.set( -.5, -.3, 0 );

    simulationProcess.setPosition( 0.3, -.14, 0 );
    simulationProcess.heading = "Simulation object";
    simulationProcess.headingPosition.set( .3, -.3, 0 );

    // Add process visuals to scene
    processArray.forEach( ( process ) => { scene.add( process.root ) } );

    // Lights
    aLight = new THREE.AmbientLight( 0xffffff, .8 );
    scene.add( aLight );

    aSpotLight = new THREE.SpotLight( 0xffffff, 30 );
    aSpotLight.position.set( 20, 10, 10 );
    scene.add( aSpotLight );

    // Renderer, Canvas & Resizing
    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.physicallyCorrectLights = true;
    canvas = renderer.domElement;
    document.body.appendChild( canvas );

    window.addEventListener( 'resize', onWindowResize );
    
    // Controls
    orbitControls = new OrbitControls(camera, canvas);
    orbitControls.saveState();
        
    transformControls = new TransformControls( camera, canvas );
    transformControls.setMode( 'rotate');
    transformControls.addEventListener( 'dragging-changed', function ( event ) {
        
        orbitControls.enabled = !event.value;
        
    } );
    scene.add( transformControls );

    // Stats
    stats = Stats();
    document.body.appendChild( stats.dom );

    // dat.GUI initialization
    initDatGUI()

    // Raycaster & Mouse events
    rayCaster = new THREE.Raycaster();
    
    canvas.addEventListener( 'mousedown', onMouseDown );

    // Load headings asynchronuously, start animation loop when done
    const loader = new FontLoader();

    loader.load( '/static/helvetiker_regular.typeface.json', function( font ) {
                
        const textConfig = {
            font: font, 
            size: 0.025, 
            height: .0015, 
            curveSegments: 8,
            bevelEnabled: true, 
            bevelThickness: 0.001, 
            bevelSize: .001, 
            bevelSegments: 4
        }
        
        const matHeading = new THREE.MeshStandardMaterial( { 

            color: new THREE.Color( colorValues.NORMAL_TEXT_COLOR ).convertSRGBToLinear(), 
            side: THREE.FrontSide 

        } );

        for ( const process of processArray ) {
                    
            const headingText = new TextGeometry( process.heading , textConfig );
            headingText.center();

            const heading = new THREE.Mesh( headingText, matHeading.clone() );
            heading.name = process.heading;
            heading.position.copy( process.headingPosition );

            scene.add( heading );

        }

        loadDefaultSourceFile();

        animate();

    }, undefined, function ( err ) {
                
        console.log("Headings could not be loaded.", err.message);
        alert( "Fatal error: Application headings could not be loaded" );
            
    });
    
}

function initDatGUI() {
    gui = new GUI();
    gui.width = 300;

    const generalFolder = gui.addFolder( "General settings" );
    generalFolder.add( aLight, "intensity", 0, 1 ).name( "Ambient light intensity" );
    generalFolder.add( aSpotLight, "power", 0, 1000 ).name( "Spot light power" );
    generalFolder.addColor( colorValues, "BG_COLOR").name( "Background color" ).onChange( () => {

        scene.background = new THREE.Color( colorValues.BG_COLOR );
        fullScreenScene.background = new THREE.Color( colorValues.BG_COLOR );

    });
    generalFolder.addColor( colorValues, "NORMAL_TEXT_COLOR" ).name( "Text color" ).onChange( setTextColors )
    generalFolder.addColor( colorValues, "FG_COLOR").name( "Object color").onChange( () => {

        for ( const process of processArray ) {

            process.defaultColor = colorValues.FG_COLOR;
            process.updateColor();

        }


    })

    const loadingFolder = gui.addFolder( "Source settings" );
    loadingFolder.add( loadingProcess, "sourceName" ).name( "Source file" );
    loadingFolder.add( { defaultSource: loadDefaultSourceFile }, "defaultSource" ).name( "Click for default source" );
    loadingFolder.add( { browseSource: browseSourceFile }, "browseSource" ).name( "Click to browse source" );

    const preprocessorFolder = gui.addFolder( "Pre-processor settings" );
    preprocessorFolder.add( preProcessorProcess, "wireframe")
        .name( "Wireframe" )
        .listen()
        .onChange( gui.updateGUI );
    preprocessorFolder.add( preProcessorProcess, "flatShading")
        .name( "Flat shading" )
        .listen()
        .onChange( gui.updateGUI );
    preprocessorFolder.add( preProcessorProcess, "reductionFactor", 0, 0.95, 0.01 )
        .name( "Reduction factor")
        .listen()
        .onFinishChange( onReductionFactorChange );

    const searchFolder = gui.addFolder( "Search settings" );
    searchFolder.add( searchProcess, "searchAlgorithm", searchProcess.searchAlgorithms )
        .name( "Algorithm")
        .listen()
        .onChange( onSearchChange );
    searchFolder.add( searchProcess, "terminatePaths" )
        .name( "Terminate the paths")
        .listen()
        .onChange( onSearchChange );

    const simulationFolder = gui.addFolder( "Simulation settings" );
    simulationFolder.add( timing, "speed", 0.005, 0.1, 0.001).name( "Speed" );
    simulationFolder.add( simulationProcess, "pointMultiplier", 1, 10, 1 )
        .name( "Point multiplier" )
        .listen()
        .onFinishChange( onPointMultiplierChange );
    gui.add( { fullScreen: onFullScreenSimulation }, "fullScreen" ).name( "Click to toggle full screen simulation" );

    gui.updateGUI = function() {
        
        for ( let folder of [ loadingFolder, preprocessorFolder, searchFolder ] ) {

            for (let i in folder.__controllers) {

                folder.__controllers[i].updateDisplay();

            }

        }
    
    }
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

// Implementation of process queue via requestIdleCallback()
function queueProcess( process, processData ) {
    
    const newProcessIndex = processArray.indexOf( process );
    
    let index = processArray.length;
    for ( let i = 0, l = processArray.length; i < l; i++ ) {

        if ( processArray[ i ].processName === state ) {

            index = i;
            break;

        }

    }

    if ( nextProcessQueueID === null ) {
        
        if ( newProcessIndex > ( index + 1 ) ) return;

        nextProcessToRun = process;
        nextProcessToRunData = processData;
        nextProcessQueueID = requestIdleCallback( runQueuedProcess, { timeout: 1000 } )

    } else {

        const queuedProcessIndex = processArray.indexOf( nextProcessToRun );

        if ( newProcessIndex < queuedProcessIndex ) {

            cancelIdleCallback( nextProcessQueueID );
            nextProcessToRun = process;
            nextProcessToRunData = processData;
            nextProcessQueueID = requestIdleCallback( runQueuedProcess, { timeout: 1000 } )

        } 

    }

}

function clearQueue() {

    cancelIdleCallback( nextProcessQueueID );
    nextProcessToRun = null;
    nextProcessToRunData = null;
    nextProcessQueueID = null;

}

function runQueuedProcess() {

    const process = nextProcessToRun;
    const processData = nextProcessToRunData;

    nextProcessToRun = null;
    nextProcessToRunData = null;
    nextProcessQueueID = null;

    if ( process ) {

        const index = processArray.indexOf( process );

        if ( index !== -1 ) {
        
            for ( let i = index + 1, l = processArray.length; i < l; i++ ) {

                processArray[ i ].reset();

            }

            state = process.processName;

            gui.updateGUI();

            setTextColors();

            process.startProcess( processData );        

        } else {

            console.warn( "QUEUE ERROR: Process could not be resolved.")

        }
    }

}

// Process callbacks
function onProcessCompleted( processName ) {

    switch ( processName ) {

        case loadingProcess.processName:
            queueProcess( preProcessorProcess, loadingProcess.result );
            break;

        case preProcessorProcess.processName:
            queueProcess( searchProcess, preProcessorProcess.result );
            break;

        case searchProcess.processName:
            queueProcess( curveIntrapolationProcess, searchProcess.result )
            break;

        case curveIntrapolationProcess.processName:
            queueProcess( simulationProcess, curveIntrapolationProcess.result );
            break;

        case simulationProcess.processName:
            timing.currentLength = 0;
            break;

    }

}

function onProcessError( err ) {

    clearQueue();
    loadDefaultSourceFile();

}

// dat.GUI event handlers
function browseSourceFile() {
        
    const scope = this;

    let input = document.getElementById( "load_source" );

    input.addEventListener('change', function browseSource() { 

        input.removeEventListener( 'change', browseSource );

        queueProcess( loadingProcess, {
            sourceFile: input.files[0],
            loadDefaultSource: false 
        } );

    });

    input.click();

}

function loadDefaultSourceFile() {

    queueProcess( loadingProcess, { loadDefaultSource: true } );

}

function onReductionFactorChange() {

    queueProcess( preProcessorProcess, loadingProcess.result );

}

function onSearchChange() {

    queueProcess( searchProcess, preProcessorProcess.result );

}

function onPointMultiplierChange() {

    queueProcess( simulationProcess, curveIntrapolationProcess.result );

}

function onFullScreenSimulation() {

    if ( fullScreenMode ) {

        simulationProcess.update( 1 );
        simulationObject.remove( simulationProcess.root );
        scene.add( simulationProcess.root );

        fullScreenScene.remove( aLight );
        scene.add( aLight );

        fullScreenScene.remove( aSpotLight );
        scene.add( aSpotLight );

        fullScreenScene.remove( transformControls );
        scene.add( transformControls );

        fullScreenMode = false;

        clock.stop();

        renderer.resetState();

    } else {

        timing.currentLength = 0;
        
        scene.remove( simulationProcess.root );
        simulationObject.add( simulationProcess.root );

        scene.remove( aLight );
        fullScreenScene.add( aLight );

        scene.remove( aSpotLight );
        fullScreenScene.add( aSpotLight );

        scene.remove( transformControls );
        fullScreenScene.add( transformControls );

        fullScreenMode = true;

    } 
    
}

function setTextColors() {

    for ( const process of processArray ) {

        const color = new THREE.Color( ( process.processName === state ) ? colorValues.FOCUS_TEXT_COLOR : colorValues.NORMAL_TEXT_COLOR ).convertSRGBToLinear();

        const textObj = scene.getObjectByName( process.heading );
        
        if ( textObj && textObj.material ) {

            textObj.material.color.set( new THREE.Color( color ) );
            textObj.material.needsUpdate = true;
            
        } 

    }
    
}

// Animation loop
function animate() {

    requestAnimationFrame( animate );

    if ( fullScreenMode ) {

        if ( state === simulationProcess.processName ) {

            if ( !clock.running ) clock.start();

            const delta = clock.getDelta();
            
            timing.currentLength = ( timing.currentLength + delta * timing.speed ) % 1;

            simulationProcess.update( timing.currentLength );

        }

        // Keep updating for sake of transformcontrols and orbitcontrols
        renderer.render( fullScreenScene, camera ); 

    } else {

        renderer.render( scene, camera );

    }

    stats.update();

}

// Mouse interaction
function toCanvasCoordsNormalized(x, y) {
    
    const rect = canvas.getBoundingClientRect();
    
    const xx = (x - rect.left) * 2 / rect.width - 1;
    const yy = (rect.top - y) * 2 / rect.height + 1; //flip the Y coordinate
        
    return new THREE.Vector2(xx, yy);

}

function onMouseDown(event) {
        
    mouseDownPosition = toCanvasCoordsNormalized(event.clientX, event.clientY);
    
    canvas.addEventListener('mouseup', onMouseUp);

}

function onMouseUp(event) {
        
    canvas.removeEventListener('mouseup', onMouseUp);
        
    mouseUpPosition = toCanvasCoordsNormalized(event.clientX, event.clientY);
    checkMouseSelect();

}

function checkMouseSelect() {
        
    // if this is a dragging motion, then do nothing -> let the orbit controls handle it
    if ( mouseDownPosition.distanceTo( mouseUpPosition ) === 0 ) {
            
        // if it was not a dragging motion, then see if an object was clicked.
        rayCaster.setFromCamera(mouseUpPosition, camera);
        const _ray = rayCaster.ray;

        const processes = ( fullScreenMode ) ? [ simulationProcess ] : processArray;

        for ( let process of processes ) {

            const boundingBox = new THREE.Box3().setFromObject( process.root );

            if ( _ray.intersectBox( boundingBox, new THREE.Vector3() ) ) {

                // Check if there is an existing selection (transform control is attached)
                if ( Boolean(transformControls.object ) ) {
                    
                    // If this object is attached, then detach (deselect) it
                    if (transformControls.object.name === process.processName ) {
                            
                        transformControls.detach();
                        
                    } else {
                        
                        // Detach (deselect) the current selection and attach (select) this one instead
                        transformControls.detach();   
                        transformControls.attach( process.root );
                        
                    }

                } else {
                        
                    // If there is no object selected, then select this one
                    transformControls.attach( process.root );

                }
                
                return;
        
            }

        }

        // If empty space is clicked, ensure nothing is selected
        if ( Boolean( transformControls.object )) transformControls.detach();
        
    }  
}