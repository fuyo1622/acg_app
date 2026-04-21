import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AddEditItem from './pages/AddEditItem';
import ItemDetail from './pages/ItemDetail';
import { LanguageProvider } from './contexts/LanguageContext';

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
      <div className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/add" element={<AddEditItem />} />
          <Route path="/edit/:id" element={<AddEditItem />} />
          <Route path="/item/:id" element={<ItemDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
