/*
Geometry Modifier
- based on code of Simplification Modifier
- based on technique of Stan Melax from 1998
- Progressive Mesh type Polygon Reduction Algorithm
- http://www.melax.com/polychop/
*/

import { BufferGeometry, Vector3, Float32BufferAttribute, Uint32BufferAttribute } from 'three';

const _cb = new Vector3();
const _ab = new Vector3();

class GeometryModifier {

	constructor() {

		this.verticesAndFaces = new VerticesAndFaces();

	}

	get verticesCount() {

		return this.verticesAndFaces.verticesCount;

	}

	get facesCount() {

		return this.verticesAndFaces.facesCount;

	}

	get faces() {

		return this.verticesAndFaces.arrFaces;

	}

	populate( geometry ) {

		console.time( "Populate modifier" );

		this.verticesAndFaces.populateFromGeometry( geometry );

		console.timeEnd( "Populate modifier" );

	}

	collapse( count ) {

		console.time( "Collapse vertices" );

		this.verticesAndFaces.collapse( count );

		console.timeEnd( "Collapse vertices" );

	}

	buildGeometry() {

		console.time( "Build geometry" );

		const simplifiedGeometry = this.verticesAndFaces.buildGeometry();

		console.timeEnd( "Build geometry" );

		return simplifiedGeometry;

	}

	modify( geometry, count ) {

		this.populate( geometry );

        this.collapse( count );

		return this.buildGeometry();

	}

}

function computeEdgeCollapseCost( u, v ) {

	// What "error" do we introduce to the geometry if we collapse edge uv by moving u to v
	const edgelength = v.position.distanceTo( u.position );
	
	let curvature = 0;

	// Find the triangles that share the edge uv
	const sideFaces = []; 
	for ( let i = 0, l = u.faces.length; i < l; i ++ ) {

		const face = u.faces[ i ];

		if ( face.hasVertex( v ) ) {

			sideFaces.push( face );

		}

	} 
		
	// Determine curvature
	if ( sideFaces.length === 2 ) {
		for ( let i = 0, l = u.faces.length; i < l; i++ ) {

			const face = u.faces[ i ];

			// Use dot product to calculate a cost proporsional to the smallest curvature
			const dotProd = Math.max( 
				face.normal.dot( sideFaces[0].normal ), 
				face.normal.dot( sideFaces[1].normal )
			);
			const minCurvature = Math.min( 1, ( 1.0 - dotProd ) / 2 );

			// The greater the best case curvature, the more damaging the collapse will be
			curvature = Math.max( curvature, minCurvature );

		} 

	} else {

		// borders are given higher cost
		curvature = 1;

	}

	return edgelength * curvature;

}
function computeEdgeCostAtVertex( v ) {

	// Compute the edge collapse cost for all edges starting from vertex v.  

	// We reduce the geometry by selecting the min cost edge at each step, 
	// so only cache the edge with least cost
	// (we cache the relevant neighbor and associated cost).

	if ( v.neighbors.length === 0 ) {

		// collapse if no neighbors/edges.
		v.collapseNeighbor = null;
		v.collapseCost = -0.01;
		return -0.01;

	}

	v.collapseNeighbor = null; // Search all neighboring edges for "least cost" edge

	const costCount = v.neighbors.length;

	for ( let i = 0; i < costCount; i ++ ) {

		const neighbor = v.neighbors[i];
		
		const collapseCost = computeEdgeCollapseCost( v, neighbor );

		if ( !v.collapseNeighbor ) {

			v.collapseNeighbor = neighbor;
			v.minCost = collapseCost;
			v.totalCost = collapseCost;

		} else {

			v.totalCost += collapseCost;

			if ( collapseCost < v.minCost ) {

				v.collapseNeighbor = neighbor;
				v.minCost = collapseCost;

			} 
		}

	} 
		
	// Use the average cost of collapsing at this vertex
	v.collapseCost = v.totalCost / costCount;
	
	return v.collapseCost;

}
    
// The triangle class represents a face
class Triangle {

	constructor( v1, v2, v3, a, b, c ) {

		this.a = a;
		this.b = b;
		this.c = c;
		this.v1 = v1;
		this.v2 = v2;
		this.v3 = v3;

		this.normal = new Vector3();
		this.computeNormal();

		this.center = new Vector3();
		this.computeCenter();

		v1.faces.push( this );
		v1.addUniqueNeighbor( v2 );
		v1.addUniqueNeighbor( v3 );

		v2.faces.push( this );
		v2.addUniqueNeighbor( v1 );
		v2.addUniqueNeighbor( v3 );

		v3.faces.push( this );
		v3.addUniqueNeighbor( v1 );
		v3.addUniqueNeighbor( v2 );

		this.hash = '' // Called once geometry modification is completed

		this.degree = 0;  // Holds number of edges to/from this face

	}

	computeHash() {

		// Note hashes are not consistent when vertex indexes change
		const indexes = [ 
			this.v1.index, 
			this.v2.index,  
			this.v3.index 
		];

		indexes.sort( ( a, b ) => { return a - b })

		this.hash = `${ indexes[0] },${ indexes[1] },${ indexes[2] }`

	}

	computeNormal() {

		const vA = this.v1.position;
		const vB = this.v2.position;
		const vC = this.v3.position;

		_cb.subVectors( vC, vB );

		_ab.subVectors( vA, vB );

		_cb.cross( _ab ).normalize();

		this.normal.copy( _cb );

	}

	computeCenter() {

		_ab.addVectors( this.v1.position, this.v2.position );
		
		_ab.add( this.v3.position ).divideScalar( 3 );

		this.center.copy( _ab );

	}

	hasVertex( v ) {

		return v === this.v1 || v === this.v2 || v === this.v3;

	}

	equals( face ) {

		return this.hash === face.hash;

	}

	get neighbors() {

		const neighborSet = new Set( [ 
			...this.v1.faces,
			...this.v2.faces,
			...this.v3.faces
		] );

		neighborSet.delete( this );

		return [...neighborSet];

	}
	
}

class Vertex {

	constructor( v, index ) {

		this.position = v;

		this.index = index; // reference to position in vertices list (for e.g. face generation)

		this.faces = []; // faces to which vertex is connected

		this.neighbors = []; // neighbouring vertices aka "adjacentVertices"

		this.collapseCost = 0; // cost of collapsing this vertex

		this.collapseNeighbor = null; // best candidate for collapsing
	}

	addUniqueNeighbor( vertex ) {

		if ( this.neighbors.indexOf( vertex ) === -1 ) {
			
			this.neighbors.push( vertex );

		}

	}

	removeIfNonNeighbor( n ) {

		// Ignore if n is not a neighbor
		const neighbors = this.neighbors;
		const offset = neighbors.indexOf( n );
		if ( offset === -1 ) return;

		// Ignore if n is a legitimate neighbor
		const faces = this.faces;
		for ( let i = 0; i < faces.length; i ++ ) {

			if ( faces[ i ].hasVertex( n ) ) return;

		}

		// else remove n
		neighbors.splice( offset, 1 );

	}

}

class VerticesAndFaces {

	constructor() {

		this.arrFaces = []; // Simple array to hold faces

		this.arrVertices = {}; //Simple array to hold vertices

		this.arrVerticesByCost = [];  //Array sorted by collapse cost to speed up picking 

	}

	get verticesCount() {

		return this.arrVertices.length;

	}

	get facesCount() {

		return this.arrFaces.length;

	}

	addVertex( vertex ) {

		const arrVertices = this.arrVertices;
		const arrVerticesByCost = this.arrVerticesByCost;

		vertex.index = arrVertices.length;
		arrVertices.push( vertex );

		// Keep arrVerticesByCost sorted
		const cost = vertex.collapseCost;

		let low = 0;
		let high = arrVerticesByCost.length - 1;
    
		while ( low < high ) {
		
			const mid = ( low + high ) >>> 1;
		
			if ( arrVertices[ arrVerticesByCost[ mid ] ].collapseCost < cost ) {
		
				low = mid + 1;
		
			} else {
		
				high = mid;
		
			}

		}

		arrVerticesByCost.splice( low, 0, vertex.index );

	}

	removeVertex( vertex ) {

		// Remove the vertex from its neighbors' neighbor lists
		const neighbors = vertex.neighbors;

		while ( neighbors.length ) {

			const n = neighbors.pop();

			const k = n.neighbors.indexOf( vertex );
			if ( k > -1 ) n.neighbors.splice( k, 1 );

		}
		
		// Remove the vertex from arrVertices
		const arrVertices = this.arrVertices;

		const index = vertex.index;
			
		arrVertices.splice( index, 1 );

		// Update the vertex indices affected. Note that the hashes of 
		// faces containing changed vertices are not undated. This is left
		// to the calling code to do...
		const vertices_count = arrVertices.length;

		for ( let i = index; i < vertices_count; i++ ) {

			arrVertices[ i ].index = i;

		}

		// Keep arrVerticesByCost synchronized
		const arrVerticesByCost = this.arrVerticesByCost;

		const cost_index = arrVerticesByCost.indexOf( index );

        if ( cost_index !== -1 ) arrVerticesByCost.splice( cost_index, 1 );

		for ( let i = 0, l = arrVerticesByCost.length; i < l; i++ ) {

			if ( arrVerticesByCost[ i ] > index ) {

				arrVerticesByCost[ i ]--;

			}

		}

	}

	removeFace( f ) {

		const arrFaces = this.arrFaces;

		// Remove from arrFaces
		const k = arrFaces.indexOf( f );
		if ( k > -1 ) arrFaces.splice( k, 1 );
			
		const a = f.v1;
		const b = f.v2;
		const c = f.v3;
	
		// Remove from the faces list of its 3x vertices
		for ( const vertex of [ a, b, c ] ) {
			
			const f_ind = vertex.faces.indexOf( f );
			if ( f_ind > -1 ) vertex.faces.splice( f_ind, 1 );
			
		}
	
		// Remove its 3x vertices from their neighbors list 
		// unless another face still connects them
		function removeNonNeighbors( s, t ) {

			if ( s && t ) {

				s.removeIfNonNeighbor( t );
				t.removeIfNonNeighbor( s );

			}

		}
	
		removeNonNeighbors( a, b );
		removeNonNeighbors( b, c );
		removeNonNeighbors( c, a );
	
	}

	indexAndMergeVertices( geometry ) {

		/*
		Based on THREE.BufferGeometryUtils.mergeVertices() method
		- Only keep the geometry's position attributes
		- Ignore morphAttributes
		- Tolerance is fixed at 4 decimal places
		- Return the position and index attributes, not a geometry
		*/
		
		console.log( "Converting non-indexed geometry to indexed geometry, and merge vertices." )
		
		for ( const name in geometry.attributes ) {
		
			if ( name !== 'position' ) geometry.deleteAttribute( name );
		
		}
		
		// Generate an index buffer if the geometry doesn't have one, alternatively optimize it.
		const hashToIndex = {};
		const indices = geometry.getIndex();
		const positions = geometry.getAttribute( 'position' );
		
		// next value for triangle indices
		let nextIndex = 0;
		
		// new position & index attribute arrays
		const positionsArray = [];
		const newIndices = [];
		
		function getHash( x, y, z ) {
		
			// truncate to 3 decimal places
			let hash = "";
		
			hash += `${ ~ ~ ( x * 10000 ) },`;
			hash += `${ ~ ~ ( y * 10000 ) },`;
			hash += `${ ~ ~ ( z * 10000 ) },`;
		
			return hash;
			
		}
		
		const vertexCount = indices ? indices.count : positions.count;
		
		for ( let i = 0; i < vertexCount; i ++ ) {
		
			const index = indices ? indices.getX( i ) : i;
		
			// Generate a hash for the vertex at the current index 'i'
			let hash = getHash( 
				positions.getX( index ), 
				positions.getY( index ), 
				positions.getZ( index ) 
			);
		
			// Add reference to the vertex if it is used by another index
			if ( hash in hashToIndex ) {
		
				newIndices.push( hashToIndex[ hash ] );
		
			} else {
		
				// copy data to the new index in positions array
				positionsArray.push( positions.getX( index ) );
				positionsArray.push( positions.getY( index ) );
				positionsArray.push( positions.getZ( index ) );
		
				hashToIndex[ hash ] = nextIndex;
				newIndices.push( nextIndex );
				nextIndex ++;
		
			}
		
		}
		
		return { 

			positions: new Float32BufferAttribute( positionsArray, 3 ),
			indices: new Uint32BufferAttribute( newIndices, 1 )
		
		};
		
	}

	populateFromGeometry( geometry ) {
	
		const { positions, indices } = this.indexAndMergeVertices( geometry.clone() );

		// Add vertices
		const vertices_count = positions.count;

		const arrVertices = this.arrVertices = [];

		for ( let i = 0; i < vertices_count; i ++ ) {

			const v = new Vector3().fromBufferAttribute( positions, i );
			
			arrVertices.push( new Vertex( v, i ) );

		} 	

		// Add faces
		const arrFaces = this.arrFaces = [];

		for ( let i = 0, l = indices.count; i < l; i += 3 ) {

			const a = indices.getX( i );
			const b = indices.getX( i + 1 );
			const c = indices.getX( i + 2 );
				
			const triangle = new Triangle( arrVertices[ a ], arrVertices[ b ], arrVertices[ c ], a, b, c );

			arrFaces.push( triangle );

		}

		// Compute the edge collapse costs
		for ( let i = 0; i < vertices_count; i ++ ) {

			computeEdgeCostAtVertex( arrVertices[ i ] );

		}

		// Create array of vertices sorted to ascending collapse costs
        const arrVerticesByCost = Array( vertices_count ).fill().map( ( value, index ) => { return index } );

        arrVerticesByCost.sort( function( index1, index2 ) {

            return arrVertices[ index1 ].collapseCost - arrVertices[ index2 ].collapseCost;

        });

		this.arrVerticesByCost = arrVerticesByCost;

		this.computeFaceHashes();

	}

	collapse( count ) {

		const arrVertices = this.arrVertices;
		const arrVerticesByCost = this.arrVerticesByCost;
		const arrFaces = this.arrFaces;

		const vertices_count = arrVertices.length;

		if ( !vertices_count || !arrFaces.length ) {

			console.log( "No vertices found to collapse.");

		}

        if ( vertices_count < count ) {

			count = vertices_count / 2;

            console.log( "Number of vertices to collapse exceed the available number. We will instead reduce by 50% or " + count + " vertices." );

        }

        for ( let i = 0; i < count; i++ ) {
            
			// Get the lowest cost vertex to delete
            const u = arrVertices[ arrVerticesByCost[ 0 ] ];
            const v = u.collapseNeighbor;

			// If u is an isolated vertex then just delete it.
			if ( !v ) {

				this.removeVertex( u );
				continue;

			}

			// Collapse the edge uv by moving vertex u onto v

			// Copy the neighbors of u
			const tmpVertices = [];

			for ( let i = 0, l = u.neighbors.length; i < l; i++ ) {

				tmpVertices.push( u.neighbors[ i ] );

			} 
				
			// Delete faces on edge uv:
			const u_faces = u.faces;

			for ( let i = u_faces.length - 1; i >= 0; i-- ) {

				if ( u_faces[ i ]?.hasVertex( v ) ) {

					this.removeFace( u_faces[ i ] );

				}

			} 
			
			// Update remaining triangles to have v instead of u
			for ( let i = u_faces.length - 1; i >= 0; i-- ) {

				const face = u_faces[ i ];

				u_faces.splice( i, 1 )
				v.faces.push( face );
				
				if ( u === face.v1 ) {
						
					face.v1 = v; 
						
				} else if ( u === face.v2 ) {
						
					face.v2 = v; 
						
				} else if ( u === face.v3 ) {
						
					face.v3 = v;
			
				}
					
				u.removeIfNonNeighbor( face.v1 );
				face.v1.removeIfNonNeighbor( u );
				
				u.removeIfNonNeighbor( face.v2 );	
				face.v2.removeIfNonNeighbor( u );
					
				u.removeIfNonNeighbor( face.v3 );
				face.v3.removeIfNonNeighbor( u );
						
				face.v1.addUniqueNeighbor( face.v2 );
				face.v1.addUniqueNeighbor( face.v3 );
				
				face.v2.addUniqueNeighbor( face.v1 );
				face.v2.addUniqueNeighbor( face.v3 );
				
				face.v3.addUniqueNeighbor( face.v1 );
				face.v3.addUniqueNeighbor( face.v2 );
				
				face.computeNormal();
				face.computeCenter();
			
				//Note: postponing re-computing the face's hash

			}

			// Now u can be safely removed
			this.removeVertex( u );
			
			// Recompute the edge collapse cost of vertices that were neighbors of u
			// Keep arrVerticesByCost sorted
			for ( let i = 0; i < tmpVertices.length; i++ ) {

				const tmpVertex = tmpVertices[ i ]
				const cost = computeEdgeCostAtVertex( tmpVertex );

				arrVerticesByCost.splice( arrVerticesByCost.indexOf( tmpVertex.index ), 1 );

				let low = 0;
				let high = arrVerticesByCost.length - 1;
			
				while ( low < high ) {
				
					const mid = ( low + high ) >>> 1;
				
					if ( arrVertices[ arrVerticesByCost[ mid ] ].collapseCost < cost ) {
				
						low = mid + 1;
				
					} else {
				
						high = mid;
				
					}

				}

				arrVerticesByCost.splice( low, 0, tmpVertex.index );

			}

        }

		// Compute hashes for all faces, now that vertex indexes are fixed
		this.computeFaceHashes

	}

	computeFaceHashes() {

		for ( const face of this.arrFaces ) {

			face.computeHash();

		} 

	}

	buildGeometry() {

		const arrVertices = this.arrVertices;
		const arrFaces = this.arrFaces;

		if ( !arrVertices.length || !arrFaces.length ) {

			console.log( "Vertices not found to build geometry.");

		}

		// Create reduced BufferGeometry
		const simplifiedGeometry = new BufferGeometry();
		const position = [];
		const index = []; 

		for ( let i = 0; i < arrVertices.length; i++ ) {

			const vertex = arrVertices[ i ].position;
			position.push( vertex.x, vertex.y, vertex.z ); 

		}

		for ( let i = 0; i < arrFaces.length; i ++ ) {

			const face = arrFaces[ i ];
			
			index.push( face.v1.index, face.v2.index, face.v3.index );

		} 

		simplifiedGeometry.setAttribute( 'position', new Float32BufferAttribute( position, 3 ) );
		simplifiedGeometry.setIndex( index );

		return simplifiedGeometry;

	}

}

export { GeometryModifier } 