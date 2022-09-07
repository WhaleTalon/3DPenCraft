import { Mesh, MeshStandardMaterial, TubeGeometry, FrontSide } from 'three';
import { mergeBufferGeometries } from 'three/utils/BufferGeometryUtils';
import { Process } from './Process.js';


class SimulationProcess extends Process {
    
    constructor( onCompleted = null, onError = null ) {

        super( "Simulation", onCompleted, onError );

        this.material = new MeshStandardMaterial( { 
            color: this.color, 
            roughness: .7,
            metalness: .2,
            side: FrontSide
        } );

        this.geometry = null;

        // Multiplies the number of points being rendered
        this.pointMultiplier = 1; 

        // The total number of points being rendered
        this.totalNumberOfPoints = 0;

        // The number of points contained in the CatmullRomCurves is
        // = this.totalNumberOfPoints / this.pointMultiplier

    }

    startProcess( params ) {

        const scope = this;

        super.startProcess();

        try {
            
            console.log( "Merge curves into single tube geometry")
            const geometries = [];

            const pointMultiplier = this.pointMultiplier;
            
            let totalNumberOfPoints = 0;

            for ( const curve of params.curves ) {

                const geometryPointCount = curve.points.length * pointMultiplier;

                totalNumberOfPoints += geometryPointCount;

                const geometry = new TubeGeometry( curve, geometryPointCount, .0006, 10, false );
            
                geometries.push( geometry );
                
            }
    
            this.totalNumberOfPoints = totalNumberOfPoints;

            // Merge the individual tube geometries
            this.geometry = mergeBufferGeometries( geometries );

            this.root.add( new Mesh( this.geometry, this.material ) ) 

            this.handleCompleted();

        }

        catch( err ) {

            scope.reset();
            
            scope.handleError( err )

        }

    }


    update( t ) {

        // Updates the geometry to reflect the status at time t in [ 0, 1 ]

        const geometry = this.geometry;
        if ( !geometry ) return;

        const position = t * this.totalNumberOfPoints;

        geometry.setDrawRange( 0, position * 6 * 10 );

    }

}

export { SimulationProcess };