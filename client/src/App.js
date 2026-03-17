

import React from "react";
import Home from "./Home";
import ErrorBoundary from "./ErrorBoundary";


function App() {
  return (
    <ErrorBoundary>
      <Home />
    </ErrorBoundary>
  );
}

export default App;
