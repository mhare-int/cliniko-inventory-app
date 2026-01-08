import { useEffect, useRef } from 'react';

/**
 * Custom hook for adding event listeners with proper cleanup
 * Prevents memory leaks by ensuring listeners are always removed
 * 
 * @param {string} eventName - The name of the event to listen for
 * @param {Function} handler - The event handler function
 * @param {Element|Window} element - The element to attach the listener to (defaults to window)
 */
function useEventListener(eventName, handler, element = window) {
  // Store handler in a ref to avoid recreating the listener on every render
  const savedHandler = useRef();
  
  // Update ref when handler changes
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);
  
  useEffect(() => {
    // Make sure element supports addEventListener
    const isSupported = element && element.addEventListener;
    if (!isSupported) return;
    
    // Create event listener that calls current handler
    const eventListener = (event) => savedHandler.current(event);
    
    // Add event listener
    element.addEventListener(eventName, eventListener);
    
    // Cleanup function removes event listener
    return () => {
      element.removeEventListener(eventName, eventListener);
    };
  }, [eventName, element]); // Re-run if eventName or element changes
}

export default useEventListener;
