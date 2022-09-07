import { Object3D, Color, Vector3 } from 'three';

class Process {

    constructor( processName, onCompleted = null, onError = null ) {

        // constants & variables
        this.rootSize = .25;
        this.defaultColor =  "#ea7340";
        this.material = null;
        this.heading = processName;
        this.headingPosition = new Vector3();

        // ProcessName must be unique
        this.processName = processName;

        // Caller should add root to scene for visualization of results
        this.root = new Object3D();
        this.root.name = processName;

        // Results produced by process
        this.result = {}

        // Callbacks
        this.onCompleted = onCompleted;
        this.onError = onError;

    }

    get color() {

        return new Color( this.defaultColor ).convertSRGBToLinear();

    }

    updateColor() {

        this.material.color = this.color;
        this.material.needsUpdate = true;

    }

    get scale() {
        return this.root.scale.clone();
    }
    set scale( value ) {
        if ( Boolean( value.isVector3 ) ) {
            this.root.scale.copy( value );
        } else {
            this.root.scale.set( value, value, value );
        }
    }

    get position() {
        return this.root.position.clone();
    }
    set position( value ) {
        if ( Boolean( value.isVector3 ) ) {
            this.root.position.copy( value );
        } else {
            console.log("Failed to set position. Value is not a Vector3 object")
        }
    }

    setPosition( x, y, z ) {
        this.root.position.set( x, y, z )
    }

    reset() {

        let meshDispose = function ( obj ) {

            if ( obj?.geometry?.dispose ) {

                obj.geometry.dispose();

            };

            if ( obj?.material ) {

                if (Array.isArray(obj.material)) {

                    obj.material.forEach( ( mat ) => { if ( mat?.dispose ) mat.dispose() } );

                } else if ( obj?.material?.dispose ) {

                     obj.material.dispose();

                }

            }

        }
    
        const root = this.root;
        root.traverse(meshDispose);
        root.clear();
        //root.scale.set( 1, 1, 1 );
        //root.rotation.set( 0, 0, 0 );

    }

    handleError( err ) {

        this.reset();
        
        // Indicate to user that process has terminated
        document.body.style.cursor = "auto";

        console.timeEnd( this.processName );
        
        const msg = "The " + this.processName + " process failed. ";
        console.log( msg + "Error description: " + err.message );

        console.groupEnd( this.processName );

        alert( msg + "\n\nSee console for more information." );

        if ( Boolean( this.onError )) this.onError( err )

    }

    handleCompleted() {

        // Indicate process has terminated
        document.body.style.cursor = "auto";

        console.timeEnd( this.processName );
        console.log( this.processName + " completed successfully.");
        console.groupEnd( this.processName );
        

        if ( Boolean(this.onCompleted )) {

            this.onCompleted( this.processName );

        }

    }

    startProcess( params = {} ) {

        // Start by removing existing results and visuals
        this.reset();
        this.result = {};

        // Indicate process has started & start timer
        console.group( this.processName );
        console.time( this.processName );
        document.body.style.cursor = "progress";

        // Derived classes to implement

    }
}

export { Process }