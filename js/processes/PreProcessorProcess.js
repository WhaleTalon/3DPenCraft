import { MeshStandardMaterial, FrontSide, Mesh, Matrix4, Vector3 } from 'three';
import { mergeBufferGeometries } from 'three/utils/BufferGeometryUtils';
import { Process } from './Process.js';
import { GeometryModifier } from '../GeometryModifier.js';

class PreProcessorProcess extends Process {

    constructor( onCompleted = null, onError = null ) {
        
        super( "Pre-processing", onCompleted, onError );

        this.material = new MeshStandardMaterial( { 
            color: this.color, 
            roughness: .7,
            metalness: .2,
            side: FrontSide, 
            wireframe: false,
            flatShading: true
        } );
        
        this.reductionFactor = 0;

    }

    get wireframe() {
        return this.material.wireframe;
    }
    set wireframe( value ) {
        value = Boolean( value );
        
        this.material.wireframe = value;

        if ( value ) this.material.flatShading = false;
        
        this.material.needsUpdate = true;
    }

    get flatShading() {
        return this.material.flatShading;
    }
    set flatShading( value ) {
        value = Boolean( value );

        this.material.flatShading = value;

        if ( value ) this.material.wireframe = false;

        this.material.needsUpdate = true;
    }

    startProcess( params ) {

        const scope = this;

        super.startProcess();

        try {

            const sourceObject = params.sourceObject;
            if ( !sourceObject ) throw new Error( "Source object is missing." )

            const sourceUUID = sourceObject.uuid;

            const reductionFactor = this.reductionFactor;

            this.result.geometryData = [];

            const geometries = [];
            let geometryCount = 0;
            let vertexTotal = 0;
            let facesTotal = 0;

            function extractGeometry( obj ) {

                if (obj.isMesh && obj.geometry && obj.geometry.isBufferGeometry) {
                    
                    geometryCount++

                    // Calculate the local transformation matrix of this geometry
                    const localMatrix = new Matrix4();
                    
                    let ancestor = obj;
                    while ( ancestor.uuid !== sourceUUID ) {

                        if ( ancestor.matrix ) {
                            
                            localMatrix.premultiply( ancestor.matrix );

                        }
                        ancestor = ancestor.parent;

                    } 

                    // Add the local translation and scale of the source 
                    const positionVector = new Vector3().setFromMatrixPosition( localMatrix );
                    positionVector.multiply( sourceObject.scale );
                    localMatrix.setPosition( positionVector );
                    localMatrix.scale( sourceObject.scale );

                    // Extract and transform the vertices & normals of this geometry
                    let geometry = obj.geometry.clone();
                    geometry.computeVertexNormals();
                    geometry.applyMatrix4( localMatrix );

                    const modifier = new GeometryModifier();
                    modifier.populate( geometry );
                    
                    console.log("Extracted geometry #" + geometryCount + ": Faces count =", modifier.facesCount, "Vertices count =", modifier.verticesCount);
                    
                    if ( reductionFactor > 0 ) {

                        const count = Math.floor( modifier.verticesCount * reductionFactor );
                        modifier.collapse( count );

                        console.log("Reduced geometry #" + geometryCount + ": Faces count =", modifier.facesCount, "Vertices count =", modifier.verticesCount);
                    }

                    const vertexCount = modifier.verticesCount;
                    vertexTotal += vertexCount;

                    const facesCount = modifier.facesCount;
                    facesTotal += facesCount;

                    if ( facesCount <= 2 ) {

                        alert("Geometry #" + geometryCount + " contains insuffiecient data.")
                        console.log( "Geometry #" + geometryCount + " contains insuffiecient data." );
        
                    } else {

                        // Extract and transform the vertices & normals of this geometry
                        geometry = modifier.buildGeometry();
                        geometry.computeVertexNormals();
                        geometries.push( geometry );

                        scope.result.geometryData.push( modifier );

                    }

                }

            }
            sourceObject.traverse( extractGeometry )

            // Show the geometry
            const mergedGeometry = mergeBufferGeometries( geometries );

            this.root.add( new Mesh( mergedGeometry, this.material ) );

            if ( geometryCount === 0 ) {

                throw new Error( "A suitable geometry could not be extracted from the source object." )

            }

            console.log( 
                "Total geometries = ", geometryCount, 
                "Total faces = ", facesTotal, 
                "Total vertices =", vertexTotal 
            );           

            this.handleCompleted();

        }

        catch( err ) {

            scope.reset();
            
            scope.handleError( err )

        }

    }

}

export { PreProcessorProcess };