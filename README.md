# Vibe Game - 3D Open World Adventure

A Three.js-based 3D open world game where you can explore, gather resources, and interact with the environment.

## Features

- 3D open world with procedurally generated terrain that expands as you explore
- Gather resources by attacking trees and rocks
- Third-person camera with orbital controls
- Deploy animal units that defend you and patrol the area
- Various unit types with different attributes and behaviors
- Minimap showing nearby resources and your position
- Simple inventory system
- Dynamic clouds

## Controls

- **WASD**: Move the player
- **Mouse Movement**: Rotate camera around player (limited to a 180° view arc)
- **Right Mouse Button + Mouse Movement**: Always works for camera rotation
- **Mouse Wheel**: Zoom camera in/out
- **C**: Toggle between orbital camera mode and follow mode
- **R**: Toggle always-rotate-with-mouse setting
- **T**: Toggle player orientation with camera view (makes character face where camera looks)
- **Q**: Open unit deployment menu to spawn animal companions
- **Space**: Jump
- **E**: Interact/Attack objects like trees and rocks
- **ESC**: Release mouse pointer

## Getting Started

### Prerequisites

- Node.js (v14 or later recommended)
- npm (comes with Node.js)

### Installation

1. Clone this repository or download the source code
2. Navigate to the project directory

```bash
cd vibegame
```

3. Install dependencies

```bash
npm install
```

4. Start the development server

```bash
npm run dev
```

5. Open your browser and visit `http://localhost:5173`

### Building for Production

To create a production build:

```bash
npm run build
```

The compiled files will be in the `dist` directory.

## Project Structure

- `src/`: Source code
  - `components/`: Game components
    - `objects/`: Interactive objects (trees, rocks, etc.)
  - `systems/`: Game systems (input, inventory, etc.)
  - `utils/`: Utility functions
  - `Game.js`: Main game class
  - `main.js`: Entry point

## Technologies Used

- [Three.js](https://threejs.org/) - 3D graphics library
- [Vite](https://vitejs.dev/) - Frontend build tool

## License

[ISC](LICENSE)

## Acknowledgments

- Three.js community for documentation and examples
- Simplex noise algorithm for terrain generation
