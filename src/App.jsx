import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AddEditItem from './pages/AddEditItem';
import ItemDetail from './pages/ItemDetail';
import Guide from './pages/Guide';
import Privacy from './pages/Privacy';
import { LanguageProvider } from './contexts/LanguageContext';
import AppErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <LanguageProvider>
      <AppErrorBoundary>
        <BrowserRouter>
          <div className="container">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/add" element={<AddEditItem />} />
              <Route path="/edit/:id" element={<AddEditItem />} />
              <Route path="/item/:id" element={<ItemDetail />} />
              <Route path="/guide" element={<Guide />} />
              <Route path="/privacy" element={<Privacy />} />
            </Routes>
          </div>
        </BrowserRouter>
      </AppErrorBoundary>
    </LanguageProvider>
  );
}

export default App;
