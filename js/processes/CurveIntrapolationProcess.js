import { CatmullRomCurve3, LineBasicMaterial, BufferGeometry, LineSegments, Color } from 'three';
import { Process } from './Process.js';


class CurveIntrapolationProcess extends Process {
    
    constructor( onCompleted = null, onError = null ) {

        super( "Curve intrapolation", onCompleted, onError );

        // Reduce the brightness of material color to match other processes,
        // since it does not respond to light
        this.material = new LineBasicMaterial( { 
            color: this.color.clone().lerp( new Color("#000000"), .6) 
        } );

    }

    startProcess( params ) {

        const scope = this;

        super.startProcess();

        try {

            const paths = params.paths;

            // Compute point interval for extraction
            let totalLength = 0;
            
            for ( const path of paths ) {
                
                let prevPoint = null;
                path.forEach( ( point ) => { 
                    
                    if ( prevPoint !== null ) {

                        totalLength += point.distanceTo( prevPoint ); 

                    }
                    
                    prevPoint = point;
                
                } );
            
            }

            let pointInterval = Math.min( 0.0012, Math.max( 0.001, params.shortestEdge/2 ) );

            const pointCount = params.pointCount;
            
            if ( pointCount > 2 && ( totalLength / pointInterval ) > 3 * pointCount ) {

                pointInterval = totalLength / (3 * pointCount);

            }

            console.log( "Shortest distance between points received:", params.shortestEdge );
            console.log( "Distance used to intrapolate curve points:", pointInterval)

            if ( pointInterval > params.shortestEdge ) {

                // Remove excess points from paths

                const intervalSqrd = pointInterval * pointInterval;

                let pointsRemoved = 0;

                for ( let i = paths.length-1; i >= 0; i-- ) {

                    const path = paths[ i ]; 

                    const pathLength = path.length;
                    let lengthSqrd = 0;
                    let prevPoint = path[ pathLength - 1 ];

                    for ( let j = pathLength - 2; j >= 0; j-- ) {

                        const point = path[ j ];

                        lengthSqrd += point.distanceToSquared( prevPoint );

                        if ( lengthSqrd < intervalSqrd ) {

                            pointsRemoved++;
                            path.splice( j, 1 );

                        } else {

                            lengthSqrd = 0;

                        }

                        prevPoint = point;
                    
                    }

                    if ( path.length < 2 ) {

                        paths.splice( i,1 );
                        pointsRemoved += path.length;

                    }

                }

                console.log( "Excess points removed:", pointsRemoved );

            }
            
            // Sort paths such that the end point of a path is close to the start point of the next
            const pathsLength = paths.length;

            for ( let i = 0, l = pathsLength; i < l; i++ ) {

                const path = paths[ i ]; 
                const endPoint = path[ path.length - 1 ];

                let bestPath = -1;
                let bestDistanceSqrd = Infinity;

                for ( let j = i + 1, m = pathsLength; j < m; j++ ) {
                    
                    const testPath = paths[ j ];

                    const distanceSqrd = endPoint.distanceToSquared( testPath[ 0 ] );

                    if ( distanceSqrd < bestDistanceSqrd ) {

                        bestDistanceSqrd = distanceSqrd;
                        bestPath = j;

                    }

                }


                if ( bestPath !== -1 && bestPath !== ( i+1 ) ) {

                    const tempPath = paths[ bestPath ];
                    paths[ bestPath ] = paths[ i + 1 ];
                    paths[ i + 1 ] = tempPath;

                }

            }
            
            console.log( "Sorted paths according to proximity in space" );
            
            const curves = this.result.curves = [];
            
            // create curve for each path
            let countPoints = 0;
            for ( let i = 0, l = paths.length; i < l; i++ ) {

                const path = paths[ i ];  // Input path

                const curve = new CatmullRomCurve3( path );

                if ( curve.getLength() > pointInterval ) {
                    
                    countPoints += path.length;
                    curves.push( curve );

                }

            }
            
            this.result.pointInterval = pointInterval;
            this.result.pointCount = countPoints;
        
            console.log( "Number of curve points:", countPoints);

            // Combine points from the separate curves for efficient curve visualization
            console.log( "Generating visual representation." )

            let points = [];
            const indices = [];
            let accumPoints = 0
            for ( let i = 0, l = curves.length; i < l; i++ ) {

                const curve = curves[ i ];

                const numPoints = Math.ceil( curve.getLength() / pointInterval);

                points = points.concat( curve.getPoints( numPoints ) );

                for ( let i = 0, l = numPoints - 1; i < l; i++ ) {

                    indices.push( accumPoints + i, accumPoints + i + 1 );

                }

                accumPoints += numPoints + 1;

            }
        
            const geometry = new BufferGeometry().setFromPoints( points );
            geometry.setIndex( indices );

            this.root.add( new LineSegments( geometry, this.material ) );

            this.handleCompleted();

        }

        catch( err ) {

            scope.reset();
            
            scope.handleError( err )

        }

    }

}

export { CurveIntrapolationProcess };