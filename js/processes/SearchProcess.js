import { LineBasicMaterial, BufferGeometry, LineSegments, Vector3, Color } from 'three';
import { Process } from './Process.js';


class SearchProcess extends Process {
    
    constructor( onCompleted = null, onError = null ) {

        super( "Searching", onCompleted, onError );

        // Reduce the brightness of material color to match other processes,
        // since it does not respond to light
        this.material = new LineBasicMaterial( { 
            color: this.color.clone().lerp( new Color("#000000"), .6) 
        } );

        // Include 'Greedy search' if wanted
        this.searchAlgorithms = [ 'Sequential walk', 'Nearest Neighbor', 'Wrapping path search' ];
        this.searchAlgorithm = 'Nearest Neighbor';

        this.previousPoint = null;
        this.previousVector = null;
        this.shortestEdge = Infinity;

        this.isDirty = false;

        this.terminatePaths = false;

    }
    
    resetPreviousPoint() {

        this.previousPoint = null;
        this.previousVector = null;

    }
    
    getNextPoint( face ) {

        if ( this.previousPoint === null ) {

            const point = face.center.clone();
            this.previousPoint = point;
            return point;

        }

        if ( this.previousVector === null ) {

            const point = face.center.clone();
            this.previousVector = new Vector3().subVectors( point, this.previousPoint );
            this.previousPoint = point;
            return point;

        }

        const prevPoint = this.previousPoint;
        const prevVector = this.previousVector;

        const a = face.v1.position;
        const b = face.v2.position;
        const c = face.v3.position;

        let k_a = ( new Vector3().subVectors( a, prevPoint) ).dot( prevVector );
        let k_b = ( new Vector3().subVectors( b, prevPoint) ).dot( prevVector );
        let k_c = ( new Vector3().subVectors( c, prevPoint) ).dot( prevVector );

        let newPoint;

        if ( Math.min( k_a, k_b, k_c ) > 0 ) {

            const sum = k_a + k_b + k_c;

            k_a /= sum;
            k_b /= sum;
            k_c /= sum;

            newPoint = a.clone().multiplyScalar( k_a ).add( b.clone().multiplyScalar( k_b ) ).add( c.clone().multiplyScalar( k_c ) );

        } else if ( k_a > k_b && k_a > k_c ) {

            newPoint = a.clone().add( face.center ).multiplyScalar( .5 );
        
        } else if ( k_b > k_c ) {

            newPoint = b.clone().add( face.center ).multiplyScalar( .5 );

        } else {

            newPoint = c.clone().add( face.center ).multiplyScalar( .5 );

        }
        
        
        this.previousVector = new Vector3().subVectors( newPoint, prevPoint );

        const distance = this.previousVector.length();
        if ( distance < this.shortestEdge ) this.shortestEdge = distance;

        this.previousPoint = newPoint;

        return newPoint;

    }

    getNearestNeighbor( face ) {

        const neighbors = face.neighbors;

        if ( !neighbors?.length ) return null;

        let prevVector = this.previousVector;

        const faceNormal = face.normal;

        let bestNeighbor = null;

        if ( prevVector === null ) {

            let cost = 0;

            for ( const neighbor of neighbors ) {

                if ( neighbor.degree < 1 ) {

                    const neighborCost = faceNormal.dot( neighbor.normal );

                    if ( neighborCost > cost ) {

                        cost = neighborCost;
                        bestNeighbor = neighbor;

                    }

                } 

            }

            if ( bestNeighbor ) bestNeighbor.degree++;

            return bestNeighbor;

        }

        const faceCenter = face.center;
        prevVector = prevVector.clone().normalize();

        for ( const neighbor of neighbors ) {

            let cost = 1;

            if ( neighbor.degree < 1 ) {

                const vector = new Vector3().subVectors( neighbor.center, faceCenter ).normalize();

                const neighborCost = 1 - prevVector.dot( vector );

                if ( neighborCost < cost ) {

                    cost = neighborCost;
                    bestNeighbor = neighbor;

                }
                
            } 

        }

        if ( bestNeighbor ) bestNeighbor.degree++;

        return bestNeighbor;

    }

    sequentialWalk( data ) {

        const paths = [];
        let path = [];

        this.resetPreviousPoint();

        const faces = data.faces;
        let prevFace = null;
        let face = null;

        for ( let i = 0, l = data.facesCount; i < l; i++ ) {

            face = faces[ i ];

            if ( !prevFace ) {

                prevFace = face
                path.push( this.getNextPoint( face ) );

            } else {

                const prevFaceHash = prevFace.hash;
                const neighbors = face.neighbors;
                let face_is_connected = false;

                for ( const neighbor of neighbors ) {

                    if ( neighbor.hash === prevFaceHash) {

                        prevFace = face;
                        path.push( this.getNextPoint( face ) );
                        face_is_connected = true;

                        break;

                    } 

                }

                if ( !face_is_connected ) {

                    if ( path.length > 1 ) paths.push( path ); 

                    this.resetPreviousPoint();
                    this.previousPoint = this.getNextPoint( face )
                    path = [];
                    path.push( this.previousPoint );
                    prevFace = face;

                }

            }

        }

        if ( path.length > 1 ) paths.push( path );

        return paths;

    }
    
    nearestNeighborSearch( data ) {

        const faces = data.faces;
        
        const facesCount = faces.length;

        if ( facesCount < 2 ) {

            alert( "Insufficient geometry data found." );
            return [];

        }

        function getStartFace() {

            for ( const face of faces ) {

                if ( face.degree === 0 ) return face;

            }

            return null;

        }

        console.log( "Selecting faces and points." );
        console.time( "Selecting faces." );
        
        const paths = [];

        let selectedCount = 0;

        let currentFace = faces[ 0 ];

        while ( selectedCount < facesCount && currentFace !== null ) {

            let startFace = currentFace;

            this.resetPreviousPoint();
        
            const path = [];
            
            while ( currentFace !== null ) {

                currentFace.degree++;
                selectedCount++;
                path.push( this.getNextPoint( currentFace ) );

                currentFace = this.getNearestNeighbor( currentFace );
            
            };

            this.resetPreviousPoint();
            this.getNextPoint( startFace );

            currentFace = this.getNearestNeighbor( startFace );

            while ( currentFace !== null ) {
                
                currentFace.degree++;
                selectedCount++;
                path.unshift( this.getNextPoint( currentFace ) );

                currentFace = this.getNearestNeighbor( currentFace );
            
            };

            if ( path.length > 1 ) paths.push( path );

            currentFace = getStartFace();

        };
        
        console.timeEnd( "Selecting faces." );

        return paths;

    }

    greedySearch( data ) {

        // Create edges

        console.log( "Creating edges.")

        const edges = new EdgeCollection();
        edges.populateFromFaces( data.faces );
        
        const total_edges = edges.count;

        if ( total_edges < 2 ) {

            alert( "Insufficient geometry data found." );
            return [];

        }

        // Select all valid edges as follows:
        // 1. Their faces have degree 2 or less,
        // 2. They do not form loops with edges already selected.

        console.log( "Created", total_edges, "edges. Now selecting valid edges." );
        console.time( "Selecting valid edges." );
        
        const selectedEdges = new EdgeCollection();

        while ( edges.count > 0 ) {
            
            const target = edges.popLowestCostEdge(); 

            if ( target.isValid() ) {
                
                if ( target.isIsolated() ) {

                    // Condition (1) above is met, and it is isolated - cannot form loop
                    selectedEdges.add( target );
                    target.incrementFaceDegrees();
            
                } else {

                    // Condition (1) above is met, now add if it does not form a closed loop
                    selectedEdges.addIfNonLooping( target )

                }
                
            } 

        }
        
        console.timeEnd( "Selecting valid edges." );
        console.log( "Done with selection" )

        // Classify and group the edges according to degree
        const [ isolatedEdges, terminalEdges, connectedEdges ] = selectedEdges.classifyAndGroupEdges();

        // Find all the paths starting from a terminal edge
        console.log( "Constructing final path of points." );
        console.time( "Constructing final path" );

        const paths = [];

        while ( terminalEdges.count > 0 && connectedEdges.count > 0 ) {

            this.resetPreviousPoint();
            
            const path = [];

            let target = terminalEdges.popLowestCostEdge();
            
            let chainFace;

            if ( target.face1.degree === 2) {

                chainFace = target.face1;
                path.push( this.getNextPoint( target.face2 ) );

            } else {

                chainFace = target.face2;
                path.push( this.getNextPoint( target.face1 ) );

            }

            while ( target ) {

                target = connectedEdges.getMatchingEdge( target, chainFace );

                if ( target ) {

                    path.push( this.getNextPoint( chainFace ) );

                    chainFace = ( target.face1.equals( chainFace ) ) ? target.face2 : target.face1;

                    connectedEdges.remove( target );

                }

            };

            path.push( this.getNextPoint( chainFace ) );

            // Find a terminalEdge to end the path
            target = terminalEdges.getMatchingEdge( null, chainFace );

            // chainedEdges can contain at most 1 chained edge if it exists
            if ( target ) {

                chainFace = ( target.face1.equals( chainFace ) ) ? target.face2 : target.face1
                
                path.push( this.getNextPoint( chainFace ) );

                terminalEdges.remove( target );

            }

            paths.push( path );

        }

        console.timeEnd( "Constructing final path" );

        if ( terminalEdges.length > 0 || connectedEdges.length > 0 ) {

            console.log( "An error occured while searching for a solution. Not all faces have been used. Terminal edges: ", terminalEdges, "Selected path edges:", connectedEdges);

        }

        return paths;

    }

    findPathFromFace( startFace ) {

        function getUnconnectedNeighbors( searchNeighbors ) {

            const neighbors = new Set();

            for ( let i = 0, l = searchNeighbors.length; i < l; i++ ) {

                const candidateNeighbors = searchNeighbors[ i ].neighbors;

                for ( let j = 0, m = candidateNeighbors.length; j < m; j++ ) {

                    const candidate = candidateNeighbors[ j ];

                    if ( candidate.degree === 0 ) {

                        neighbors.add( candidate );

                    }

                }

            }

            return [ ...neighbors ];

        }

        function removeNearestNeighbor( neighbors, face ) {

            const validArray = face.neighbors;
            let distanceSqrd = Infinity;
            let nearest = null;
            let index = -1;
            let facePoint = face.center;

            for ( let i = 0, l = neighbors.length; i < l; i++ ) {

                const neighbor = neighbors[ i ];

                if ( validArray.indexOf( neighbor ) === -1 ) continue;

                const neighborDistanceSqrd = facePoint.distanceToSquared( neighbor.center );
                
                if ( neighborDistanceSqrd < distanceSqrd ) {

                    distanceSqrd = neighborDistanceSqrd;
                    nearest = neighbor;
                    index = i;

                }

            }

            if ( index !== -1 ) {

                neighbors.splice( index, 1 );

            }

            return nearest;

        }

        function differenceArray( A, B ) {

            for ( let i = 0, l = B.length; i < l; i++ ) {

                const index = A.indexOf( B[ i ] );

                if ( index !== -1 ) {

                    A.splice( index, 1 );

                }

            }

        }

        let currentFace = startFace;

        const path = [ currentFace ];

        currentFace.degree++;

        let activeNeighbors = [ currentFace ]

        while ( activeNeighbors.length > 0 ) {

            let currentNeighbors = getUnconnectedNeighbors( activeNeighbors );

            activeNeighbors = [];

            currentNeighbors.forEach( ( value ) => { activeNeighbors.push( value ) })

            while ( currentNeighbors.length > 0 ) {

                const tmpFace = removeNearestNeighbor( currentNeighbors, currentFace )	

                if ( tmpFace ) {
                    
                    path.push( tmpFace );

                    tmpFace.degree++;

                    currentFace = tmpFace;
                
                } else {

                    differenceArray( activeNeighbors, currentNeighbors );

                    currentNeighbors = [];

                }

            }

        }

        return path;

    }   

    WrappingPathSearch( data ) {

        const faces = data.faces;

        let previousIndex = -1;

        function getNextFace() {

            for ( let i = previousIndex + 1, l = faces.length; i < l; i++ ) {

                if ( faces[ i ].degree === 0 ) {

                    previousIndex = i;

                    return faces[ i ];

                }

            }

        }

        const pointPaths = [];

        let nextFace = getNextFace();

        while ( nextFace ) {

            const facePath = this.findPathFromFace( nextFace )

            this.resetPreviousPoint();

            const pointPath = [];

            for ( let i = 0, l = facePath.length; i < l; i++ ) {

                pointPath.push( this.getNextPoint( facePath[ i ] ) );

            }

            pointPaths.push( pointPath );

            nextFace = getNextFace();

        }

        return pointPaths;

    }

    terminatePathPoints( searchPaths ) {

        // Terminating the paths 
        console.log( "Terminating the paths found. ");

        for ( let i = 0, l = searchPaths.length; i < l; i++ ) {

            const path = searchPaths[ i ];

            const pointStart = path[ 0 ];
            const pointEnd = path[ path.length - 1 ];

            let terminalStart = null, terminalEnd = null;
            let startDistance = Infinity, endDistance = Infinity;

            for ( let j = 0, m = searchPaths.length; j < m; j++ ) {

                //if ( i === j ) continue;

                const pointPath = searchPaths[ j ];

                for ( let k = ( i === j ) ? 2 : 0, n = ( i === j ) ? pointPath.length-2 : pointPath.length; k < n; k++ ) {

                    const point = pointPath[ k ];
                        
                    const start = point.distanceToSquared( pointStart );

                    if ( start < startDistance && point.x !== pointStart.x && point.y !== pointStart.y && point.z !== pointStart.z ) {

                        startDistance = start;
                        terminalStart = point;

                    } 

                    const end = point.distanceToSquared( pointEnd );

                    if ( end < endDistance && point.x !== pointEnd.x && point.y !== pointEnd.y && point.z !== pointEnd.z ) {

                        endDistance = end;
                        terminalEnd = point;

                    } 

                }

            }

            if ( terminalStart ) path.unshift( terminalStart.clone() );
            if ( terminalEnd ) path.push( terminalEnd.clone() );

        }

    }

    get searchFunction() {
        const scope = this;
        
        switch ( this.searchAlgorithm ) {

            case 'Sequential walk':
                return function( data ) { 
                    
                    return scope.sequentialWalk( data );
                
                };

            case 'Nearest Neighbor':
                return function( data ) { 
                
                    scope.isDirty = true;
                    return scope.nearestNeighborSearch( data );
                
                };

            case 'Greedy search':
                return function( data ) { 
                    
                    scope.isDirty = true;
                    return scope.greedySearch( data );
                
                };

            case 'Wrapping path search':
                return function( data ) { 
                        
                    scope.isDirty = true;
                    return scope.WrappingPathSearch( data );
                    
                };

        }

    }

    startProcess( params ) {

        const scope = this;

        super.startProcess();

        try {

            const geometryData = params.geometryData;
            const geometryCount = ( geometryData ) ? geometryData.length : 0;
            if ( !geometryData || geometryCount < 1) throw new Error( "Geometry data is missing." );

            if ( this.isDirty ) {

                for ( let i = 0; i < geometryCount; i++ ) {

                    const faces = geometryData[ i ].faces;

                    for ( let j = 0, l = faces.length; j < l; j++ ) {

                        faces[ j ].degree = 0;

                    }

                }

                this.isDirty = false;

            }

            const extractPaths = this.searchFunction;
            
            console.log( "Path search using: %s algorithm", this.searchAlgorithm );

            let pathCount = 0

            const searchPaths = [];
            this.shortestEdge = Infinity;

            for ( let i = 0; i < geometryCount; i++ ) {

                const data = geometryData[ i ];

                const paths = extractPaths( data );
    
                if ( paths.length === 0 ) continue;

                pathCount += paths.length;

                searchPaths.push( ...paths );

            }
            
            if ( this.terminatePaths ) {

                this.terminatePathPoints( searchPaths );

            }

            this.result.paths = searchPaths;

            this.result.shortestEdge = this.shortestEdge;

            // Combine points from the separate line paths for a more efficient rendering
            let points = [];
            const indices = [];
            let accumPoints = 0

            console.log( "Creating visual representation" );

            for ( let i = 0, l = searchPaths.length; i < l; i++ ) {

                const line = searchPaths[ i ];

                const numPoints = line.length;

                points = points.concat( line );

                for ( let i = 0, l = numPoints - 2; i < l; i++ ) {

                    indices.push( accumPoints + i, accumPoints + i + 1 );

                }

                accumPoints += numPoints;

            }
        
            const geometry = new BufferGeometry().setFromPoints( points );
            geometry.setIndex( indices );

            this.root.add( new LineSegments( geometry, this.material ) );

            let pointCount = 0;
            searchPaths.forEach( value => pointCount += value.length );
            
            console.log( "Number of paths found: " + pathCount );
            console.log( "Number of points found: " + pointCount );

            this.result.pointCount = pointCount;

            this.handleCompleted();

        }

        catch( err ) {

            scope.reset();
            
            scope.handleError( err )

        }

    }

}

// Used by Greedy Search
class Edge {

    constructor( face1, face2 ) {

        this.face1 = face1;
        this.face2 = face2;

        this.cost = 0;
        this.computeCost();

        /*  Note: If faces/vertices change, the edge hashes will remain unique.
            However, testing if an includes a face will fail, because the face's hash 
            had changed and the matching algorithm uses startsWith and endsWith again
            the edge hash (that contains the old hash of the face) 
        */          
        const hash1 = face1.hash;
        const hash2 = face2.hash;

        if ( hash1.localeCompare( hash2 ) === -1 ) {

            this.hash = `${ hash1 }-${ hash2 }`;

        } else {

            this.hash =  `${ hash2 }-${ hash1 }`;

        }

    }

    hasFace( face ) {

        const hash = face.hash;

        return ( hash === this.face1.hash  ||  hash === this.face2.hash ); 

    }

    equals( edge ) {

        return ( this.hasFace( edge.face1 ) && this.hasFace( edge.face2 ) )

    }

    computeCost() {

        this.cost = 1-this.face1.normal.dot( this.face2.normal );

    }

    incrementFaceDegrees() {
            
        this.face1.degree++
            
        this.face2.degree++

    }

    isValid() {

        return this.face1.degree < 2 && this.face2.degree < 2;

    }

    isIsolated() {

        return this.face1.degree === 0 && this.face2.degree === 0;
    }

    midpoint() {

        return new Vector3().addVectors( this.face1.center, this.face2.center ).multiplyScalar(.5);
        
    }


    distanceToSquared( point ) {

        return point.distanceToSquared( this.midpoint() );

    }

}

class EdgeCollection {

    constructor() {

        this.lutEdges = {};   // Look up table holds edges to speed up searches

        this.arrEdgesByCost = [];   // Array of hashes sorted by cost to speed up picking

    }

    get count() {

        return this.arrEdgesByCost.length;

    }

    getHashFromFaces( face1, face2 ) {

        const hash1 = face1.hash;
        const hash2 = face2.hash;

        if ( hash1.localeCompare( hash2 ) === -1 ) {

            return `${ hash1 }-${ hash2 }`;

        } else {

            return `${ hash2 }-${ hash1 }`;

        }

    }

    add( edge ) {

        const lutEdges = this.lutEdges;
        const arrEdgesByCost = this.arrEdgesByCost;

        const hash = edge.hash;

        // If edge is not contained already, then insert it
        if ( !lutEdges[ hash ] ) {

            lutEdges[ hash ] = edge;

            // Keep arrEdgesByCost sorted
            const cost = edge.cost;
            let low = 0;
            let high = arrEdgesByCost.length - 1;
    
            while ( low < high ) {
    
                const mid = ( low + high ) >>> 1;
    
                if ( lutEdges[ arrEdgesByCost[ mid ] ].cost < cost ) {
    
                    low = mid + 1;
    
                } else {
    
                    high = mid;
    
                }
    
            }
    
            arrEdgesByCost.splice( low, 0, hash );

        }

    }

    remove( edge ) {

        const lutEdges = this.lutEdges;
        const arrEdgesByCost = this.arrEdgesByCost;

        const hash = edge.hash;

        // Delete from the look up table
        delete lutEdges[ hash ];
        
        // Delete from the cost sorted array
        const index = arrEdgesByCost.indexOf( hash );

        if ( index !== -1 ) arrEdgesByCost.splice( index, 1 );

    }

    popLowestCostEdge() {

        const edgeHash = this.arrEdgesByCost.shift();
        
        if ( edgeHash === undefined ) return null;

        const edge = this.lutEdges[ edgeHash ];

        if ( edge === undefined ) return null;

        delete this.lutEdges[ edgeHash ];

        return edge;

    }

    getLowestCostEdge() {

        const edgeHash = this.arrEdgesByCost[ 0 ];
        
        if ( edgeHash === undefined ) return null;

        const edge = this.lutEdges[ edgeHash ];

        if ( edge === undefined ) return null;

        return edge;

    }

    populateFromFaces( arrFaces ) {
        
        this.lutEdges = {};
        this.arrEdgesByCost = [];

        const lutEdges = this.lutEdges;
        const arrEdgesByCost = this.arrEdgesByCost;

        for ( let i = 0, l = arrFaces.length; i < l; i++ ) {

            const face = arrFaces[ i ];

            const neighbors = face.neighbors;
            
            for ( let j = 0, m = neighbors.length; j < m; j++ ) {

                const hash = this.getHashFromFaces( face, neighbors[ j ] );
                
                // If edge is not contained already, then insert it
                if ( !lutEdges[ hash ] ) {

                    const edge = new Edge( face, neighbors[ j ] );

                    lutEdges[ hash ] = edge;
            
                    arrEdgesByCost.push( hash );

                }

            }

        }
        
        // Now sort arrEdgesByCost
        arrEdgesByCost.sort( ( edge_hash1, edge_hash2 ) => { return lutEdges[ edge_hash1 ].cost - lutEdges[ edge_hash2 ].cost });

    }

    getMatchingEdge( edgeToExclude, faceToMatch) {

        const hashToMatch = faceToMatch.hash;

        const hashToExclude = ( edgeToExclude ) ? edgeToExclude.hash : '';

        const foundHash = this.arrEdgesByCost.find( candidateHash => { 

            return ( candidateHash.startsWith( hashToMatch ) || candidateHash.endsWith( hashToMatch ) ) && candidateHash !== hashToExclude 
        
        } );

        let found =  ( foundHash ) ? this.lutEdges[ foundHash ] : null;
        found = ( found ) ? found : null;
        
        return found

    }

    addIfNonLooping( target ) {

        let chainedEdge = target;
        const testFace = target.face1; 
        let chainFace = target.face2;

        do {

            chainedEdge = this.getMatchingEdge( chainedEdge, chainFace )
            
            if ( !chainedEdge ) {

                // No loop found - add the target
                this.add( target );
                target.incrementFaceDegrees();
                return;

            };
            
            chainFace = ( chainedEdge.face1.equals( chainFace ) ) ? chainedEdge.face2 : chainedEdge.face1;

            if ( chainFace.degree === 1 && !chainFace.equals( testFace ) ) {

                // No loop possible - add the target
                this.add( target );
                target.incrementFaceDegrees();
                return;

            }


        } while ( !chainFace.equals( testFace ) )

        // A loop was found - return without adding target
        return;

    }

    getEdgesWithFace( face ) {

        const lutEdges = this.lutEdges;

        const hash = face.hash;

        const hashes =  this.arrEdgesByCost.filter( edgeHash => edgeHash.startsWith( hash ) || edgeHash.endsWith( hash ) );

        if ( hashes && hashes.length ) {

            return hashes.map( edgeHash => lutEdges[ edgeHash ] );

        } else {

            return [];
        }

    }

    getCostEdgeN( n ) {

        try {

            const edge = this.lutEdges[ this.arrEdgesByCost[ n ] ];

            return ( edge ) ? edge : null;

        }
         
        catch( err ) {

            return null;

        }

    }

    getBestCostEdges( count ) {

        const lutEdges = this.lutEdges;

        const arrEdges = this.arrEdgesByCost.slice( 0, count );

        if ( arrEdges && arrEdges.length ) {

            return arrEdges.map( edge_hash => lutEdges[ edge_hash ] );

        } else {

            return [];

        }
        
    }

    findClosestEdge( point ) {

        const arrEdgesByCost = this.arrEdgesByCost;
        const lutEdges = this.lutEdges;

        let distanceSquared = Infinity;
        let closestEdge = null;

        for ( let i = 0, l = arrEdgesByCost.length - 1; i < l; i++ ) {

            const edge = lutEdges[ arrEdgesByCost[ i ] ];
            
            const distance = edge.distanceToSquared( point );
            
            if ( distance < distanceSquared ) {

                distanceSquared = distance;
                closestEdge = edge;
                
            }

        }

        return closestEdge;
 
    }

    classifyAndGroupEdges() {

        const lutEdges = this.lutEdges;

        const isolatedEdges = new EdgeCollection();
        const terminalEdges = new EdgeCollection();
        const connectedEdges = new EdgeCollection();

        this.arrEdgesByCost.forEach( ( edgeHash ) => {

            const edge = lutEdges[ edgeHash ];

            const degree1 = edge.face1.degree;
            const degree2 = edge.face2.degree;

            if ( ( degree1 < 2 ) && ( degree2 < 2 ) ) {
                
                isolatedEdges.lutEdges[ edgeHash ] = edge;
                isolatedEdges.arrEdgesByCost.push( edgeHash );

            } else if ( degree1 < 2 || degree2 < 2 ) {

                terminalEdges.lutEdges[ edgeHash ] = edge;
                terminalEdges.arrEdgesByCost.push( edgeHash );

            } else {

                connectedEdges.lutEdges[ edgeHash ] = edge;
                connectedEdges.arrEdgesByCost.push( edgeHash );

            }

        } );

        return [ isolatedEdges, terminalEdges, connectedEdges ]

    }

}

export { SearchProcess };