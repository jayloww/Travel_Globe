import * as THREE from "three";
import { gsap } from "gsap";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { getFresnelMat } from "./getGlow.js";
import { countries } from "./getCountries.js";
import getStarfield from "./getStarfield.js";

let scene, camera, renderer, textureMesh, cloudsMesh, glowMesh, light;
let width = window.innerWidth;
let height = window.innerHeight;
let controls;
let currentTween; // Tween = Animation
let sphericalCameraPosition = new THREE.Spherical();
let canvas;

function setup() {
    // Canvas aus dem Html (DOM) holen
    canvas = document.querySelector("canvas.webgl");

    // Preload country card images to prevent positioning issues on first display
    preloadCountryImages();

    // Scene: Das ist die Hierarchie aller 3D-Objekte, Kameras, Lichter, etc.
    scene = new THREE.Scene();
    scene.background = new THREE.Color("rgb(0, 0,0)");

    initCamera();
    initObjects();
    initLight();

    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
    });

    renderer.setSize(width, height); 
    renderer.setPixelRatio(window.devicePixelRatio);

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = false;

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("resize", onWindowResize);
}

function initCamera(){
    camera = new THREE.PerspectiveCamera(75, width/height, 0.01, 100);
    camera.position.z = 10;
    sphericalCameraPosition.setFromVector3(camera.position);

    scene.add(camera);
}

function initObjects(){
    // Kugel geometrie erstellen
    const geometry = new THREE.SphereGeometry(5, 50, 50);

    // Create a loading manager to track progress
    const loadingManager = new THREE.LoadingManager();
    
    // Variables for smooth progress animation
    let currentProgress = 0;
    let targetProgress = 0;
    const progressBar = document.querySelector('.progress-bar');
    const loadingText = document.querySelector('.loading-text');
    
    function animateProgress() {
        if (currentProgress < targetProgress) {
            const increment = Math.max(0.5, (targetProgress - currentProgress) * 0.05);
            currentProgress = Math.min(currentProgress + increment, targetProgress);
            
            const displayProgress = Math.floor(currentProgress);
            progressBar.style.width = `${currentProgress}%`;
            loadingText.textContent = `Loading Globe... ${displayProgress}%`;
            
            if (currentProgress < targetProgress) {
                requestAnimationFrame(animateProgress);
            }
        }
    }
    
    loadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
        targetProgress = Math.floor(itemsLoaded / itemsTotal * 100);
        if (!requestAnimationFrame.isAnimating) {
            requestAnimationFrame.isAnimating = true;
            requestAnimationFrame(animateProgress);
        }
    };
    
    loadingManager.onLoad = function() {
        targetProgress = 100;
        
        function finalProgress() {
            if (currentProgress >= 100) {
                setTimeout(() => {
                    document.getElementById('loading-overlay').classList.add('hidden');
                }, 500);
            } else {
                const increment = Math.max(0.5, (100 - currentProgress) * 0.05);
                currentProgress = Math.min(currentProgress + increment, 100);
                
                const displayProgress = Math.floor(currentProgress);
                progressBar.style.width = `${currentProgress}%`;
                loadingText.textContent = `Loading Globe... ${displayProgress}%`;
                
                requestAnimationFrame(finalProgress);
            }
        }
        
        requestAnimationFrame(finalProgress);
    };

    // Textur laden with loading manager
    const loader = new THREE.TextureLoader(loadingManager);
    const colorTexture = loader.load("textures/nasaWorldmap.jpg");
    colorTexture.generateMipmaps = false;
    const bumpTexture = loader.load("textures/earthbump1k.jpg");
    const cloudTexture = loader.load("textures/africa_clouds_8k.jpg");

    const cloudsMaterial = new THREE.MeshStandardMaterial({
        map: cloudTexture,
        opacity: 0.6,
        transparent: true, 
        blending: THREE.AdditiveBlending,
    });


    // Farbe und Textur festlegen
    const textureMaterial = new THREE.MeshStandardMaterial({
        map: colorTexture,
        bumpMap: bumpTexture,
        bumpScale: 1,
    });

    const stars = getStarfield({numStars: 1000})

    textureMesh = new THREE.Mesh(geometry, textureMaterial);

    cloudsMesh = new THREE.Mesh(geometry, cloudsMaterial);
    cloudsMesh.scale.set(1.01, 1.01, 1.01);

    const glowMaterial = getFresnelMat();
    glowMesh = new THREE.Mesh(geometry, glowMaterial);
    glowMesh.scale.set(1.01, 1.01, 1.01);

    scene.add(glowMesh);
    scene.add(textureMesh);    
    scene.add(cloudsMesh);
    scene.add(stars)
}

function initLight(){
    light = new THREE.AmbientLight("rgb(255, 255, 255)", 1.2);
    scene.add(light);
}

function animate(){
    requestAnimationFrame(animate);

    controls.update();
    renderer.render(scene, camera);
    sphericalCameraPosition.setFromVector3(camera.position)

    cloudsMesh.rotation.y += 0.00015;
    glowMesh.rotation.y += 0.00015;
    
    // console.log({
    //     radius: sphericalCameraPosition.radius,
    //     theta: sphericalCameraPosition.theta, 
    //     phi: sphericalCameraPosition.phi      
    // });
}

function onMouseUp(event) {
    if (event.target.id === "countryButton" || event.target.id === "closeButton") {
        return;
    }

    let closestCountry = getClosestCountry();
    animateToPosition(
        closestCountry.position.radius, 
        closestCountry.position.theta, 
        closestCountry.position.phi, 
        2
    );
}


function onMouseDown(){
    if (currentTween) {
        currentTween.kill();
        currentTween = null;
    }
    resetRadius();
    hideCountryCard();

    const rotationIconContainer = document.getElementById('rotation-icon-container');
    if (rotationIconContainer && !rotationIconContainer.classList.contains('hidden')) {
        rotationIconContainer.classList.add('hidden');
    }
}

function animateToPosition(
    radius = sphericalCameraPosition.radius, 
    targetTheta = sphericalCameraPosition.theta, 
    targetPhi = sphericalCameraPosition.phi, 
    duration = 2
){
    displayCountryCard(getClosestCountry());
    currentTween = gsap.to(sphericalCameraPosition.setFromVector3(camera.position), {
        radius: radius,
        theta: targetTheta,
        phi: THREE.MathUtils.clamp(targetPhi, 0.1, Math.PI - 0.1),
        duration: duration,
        onUpdate: () => {
            camera.position.setFromSpherical(sphericalCameraPosition);
        },
        onComplete: () => {
            currentTween = null;
        }
    });
}

function getClosestCountry() {
    let closestCountry = null;
    let closestAngleDifference = Infinity;

    const cameraTheta = sphericalCameraPosition.theta;
    const cameraPhi = sphericalCameraPosition.phi;

    countries.forEach((country) => {
        const { theta, phi } = country.position;

        const thetaDifference = Math.abs(cameraTheta - theta);
        const phiDifference = Math.abs(cameraPhi - phi);

        const angleDifference = thetaDifference + phiDifference;

        if (angleDifference < closestAngleDifference) {
            closestAngleDifference = angleDifference;
            closestCountry = country;
        }
    });

    return closestCountry;
}

function displayCountryCard(country) {
    const countryCard = document.getElementById("countryCard");
    const countryImage = document.getElementById("countryImage");
    countryImage.src = country.cardurl;
    countryCard.classList.add("visible");
}

function hideCountryCard() {
    const countryCard = document.getElementById("countryCard");
    countryCard.classList.remove("visible");
}



function resetRadius(targetRadius = 10, duration = 1.5) {
    sphericalCameraPosition.setFromVector3(camera.position);
    
    currentTween = gsap.to(sphericalCameraPosition, {
        radius: targetRadius,
        duration: duration,
        onUpdate: () => {
            controls.enable = true;
            controls.dampingFactor = 0.15;
            camera.position.setFromSpherical(sphericalCameraPosition);
        },
        onComplete: () => {
            controls.dampingFactor = 0.25;
            currentTween = null;
        }
    });
}

document.getElementById("countryButton").addEventListener("click", function(event) {
    event.stopPropagation();
    console.log("Country button clicked!");
});

document.getElementById("closeButton").addEventListener("click", function(event) {
    event.stopPropagation();
    console.log("Close button clicked!");
    hideCountryCard();
    resetRadius();
});

const cornerIcon = document.getElementById("corner-icon");

['mousedown', 'mouseup', 'click', 'dblclick', 'mousemove', 'mouseenter', 'mouseleave'].forEach(eventType => {
    cornerIcon.addEventListener(eventType, function(e) {
        e.stopPropagation();
        e.preventDefault();
        
        if (eventType === 'mouseenter' && controls) {
            controls.enabled = false;
        }
        
        if (eventType === 'mouseleave' && controls) {
            controls.enabled = true;
        }
        
        if (eventType === 'click') {
            toggleFullScreen();
        }
    }, true);
});

function onWindowResize() {
    width = window.innerWidth;
    height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function preloadCountryImages() {
    const preloadDiv = document.createElement('div');
    preloadDiv.style.display = 'none';
    document.body.appendChild(preloadDiv);
    
    countries.forEach(country => {
        const img = new Image();
        img.src = country.cardurl;
        preloadDiv.appendChild(img);
    });
}

function toggleFullScreen() {
    if (!document.fullscreenElement && 
        !document.mozFullScreenElement && 
        !document.webkitFullscreenElement && 
        !document.msFullscreenElement) {
        cornerIcon.classList.add('fullscreen');
        
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) {
            document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    } else {
        cornerIcon.classList.remove('fullscreen');
        
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

function checkDevice() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        const mobileMessage = document.createElement('div');
        mobileMessage.style.position = 'fixed';
        mobileMessage.style.top = '0';
        mobileMessage.style.left = '0';
        mobileMessage.style.width = '100%';
        mobileMessage.style.height = '100%';
        mobileMessage.style.backgroundColor = 'black';
        mobileMessage.style.color = 'white';
        mobileMessage.style.display = 'flex';
        mobileMessage.style.justifyContent = 'center';
        mobileMessage.style.alignItems = 'center';
        mobileMessage.style.zIndex = '2000';
        mobileMessage.style.boxSizing = 'border-box';
        mobileMessage.style.padding = '20px 0';
        
        mobileMessage.innerHTML = `
            <div style="width: 90%; max-width: 500px; text-align: center; padding: 0 15px; box-sizing: border-box;">
                <h2 style="font-size: 24px; margin-bottom: 20px; font-family: Arial, sans-serif;">Desktop Experience Recommended</h2>
                <p style="font-size: 16px; line-height: 1.5; font-family: Arial, sans-serif;">This 3D globe experience works best on desktop devices. Please visit on a laptop or desktop computer for the full experience.</p>
            </div>
        `;
        
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        
        document.body.appendChild(mobileMessage);
        
        return false;
    }
    return true;
}

if (checkDevice()) {
    setup();

    if (canvas) {
        canvas.addEventListener('mousedown', function(e) {
            if (e.target === cornerIcon || cornerIcon.contains(e.target)) {
                e.stopPropagation();
                return false;
            }
        }, true);
    }

    animate();
}