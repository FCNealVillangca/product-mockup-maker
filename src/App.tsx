import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ProductVisualizerPage } from "./pages/ProductVisualizerPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<ProductVisualizerPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
