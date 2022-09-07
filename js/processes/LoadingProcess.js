import { TorusKnotBufferGeometry, MeshPhongMaterial, FrontSide, Mesh, Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/loaders/GLTFLoader';
import { OBJLoader } from 'three/loaders/OBJLoader';
import { FBXLoader } from 'three/loaders/FBXLoader';
import { Process } from './Process.js';

class LoadingProcess extends Process {

    constructor( onCompleted = null, onError = null ) {
        
        super( "Loading", onCompleted, onError );

        // Default source definition (consists of a primitive that do not need to be imported)
        this.defaultGeometry = new TorusKnotBufferGeometry( this.rootSize/4, this.rootSize/10, 200, 20, 2, 3 );

        this.material = new MeshPhongMaterial( { color: this.color, side: FrontSide } );

        this.sourceName = "None";

    }

    handleError( err ) {

        this.sourceName = "None";

        super.handleError( err );

    }

    startProcess( params ) {

        const scope = this;

        super.startProcess();

        try {

            this.root.scale.set( 1, 1, 1 );
            this.root.rotation.set( 0, 0, 0 );

            if ( params.loadDefaultSource === true ) {

                console.log( "Loading default object: Torus Knot" );
                
                this.root.add( new Mesh( this.defaultGeometry.clone(), this.material.clone() ) );

                this.sourceName = "Torus knot (default object)"

                this.result.sourceObject = this.root;

                this.handleCompleted();

                return;

            }

            const sourceFile = params.sourceFile;
            if ( !sourceFile ) throw new Error( "Source file not identified." )

            this.sourceName = sourceFile.name;
            const extension = sourceFile.name.split('.').pop().toLowerCase();

            console.log( "Loading file:", this.sourceName );

            const reader = new FileReader();
            reader.addEventListener( "error", function() {

                scope.handleError( new Error("File could not be read.") );

            });

            switch (extension) {

                case 'gltf':
                case 'glb':

                    reader.addEventListener( 'load', function( event ) {

                        scope.loadGLTF( event.target.result );

                    }, false );

                    reader.readAsArrayBuffer( sourceFile );

                    break;

                case 'obj':

                    reader.addEventListener( 'load', function( event ) {
                            
                        scope.loadOther( event.target.result, new OBJLoader() );
                    
                    }, false );

                    reader.readAsText( sourceFile );

                    break;

                case "fbx":

                    reader.addEventListener( 'load', function ( event ) {
                            
                        scope.loadOther( event.target.result, new FBXLoader() );
                        
                    }, false );

                    reader.readAsArrayBuffer( sourceFile );

                    break;

                default:

                    throw new Error("The source file format is not recognized or not a supported (.obj, .gltf, .glb or .fbx) format.");
            }
        }

        catch( err ) {

            scope.handleError( err )

        }

    }

    loadGLTF( contents ) {

        const scope = this;

        const loader = new GLTFLoader();
        
        loader.parse( contents, '', function( result ) {

            scope.loadObject( result.scene );

        }, function( err ) {

            scope.handleError( err );

        } );

    }
    
    loadOther( contents, loader ) {

        try {

            let object = loader.parse( contents );
            this.loadObject( object );

        }
    
        catch( err ) {

            this.handleError( err );

        }

    }

    loadObject( newMesh ) {

        try {

            // Remove scaling. Scale will be applied to root object.
            newMesh.scale.set( 1, 1, 1 );

            // Compute vertex normals if not present already
            newMesh.traverse(

                function(child) {

                    if ( child.isMesh && child.geometry && !child.geometry.hasAttribute( "normal" ) ) {
                        child.geometry.computeVertexNormals();
                    }

                }

            );
            newMesh.updateMatrixWorld( true );

            // Measure the new object
            newMesh.traverse(

                function( child ) {

                    if ( child.isMesh && child.geometry ) {
                        child.geometry.computeBoundingBox();
                    }

                }

            )
            let bbox = new Box3().setFromObject( newMesh );
            const size = bbox.getSize( new Vector3() );

            // Swop the newMesh for the existing one
            this.reset();
            this.root.add( newMesh );
            this.scale = this.rootSize/size.length();
            this.root.updateMatrixWorld( true );

            // Center the mesh
            newMesh.traverse(

                function( child ) {

                    if ( child.isMesh && child.geometry ) {
                        child.geometry.computeBoundingBox();
                    }

                }

            );

            bbox = new Box3().setFromObject( newMesh );
            let center = bbox.getCenter( new Vector3() ); 
            center = center.sub( this.position );
            center.divide( this.scale );
            newMesh.position.sub( center );
            this.root.updateMatrixWorld( true );

            this.result.sourceObject = this.root;

            this.handleCompleted();

        }

        catch( err ) {

            this.handleError( err );

        }
    }
}

export { LoadingProcess };