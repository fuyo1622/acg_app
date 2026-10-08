import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AddEditItem from './pages/AddEditItem';
import ItemDetail from './pages/ItemDetail';
import Wishlist from './pages/Wishlist';
import AddEditWishlistEntry from './pages/AddEditWishlistEntry';
import WishlistDetail from './pages/WishlistDetail';
import Guide from './pages/Guide';
import Privacy from './pages/Privacy';
import NotFound from './pages/NotFound';
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
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/wishlist/add" element={<AddEditWishlistEntry />} />
              <Route path="/wishlist/edit/:id" element={<AddEditWishlistEntry />} />
              <Route path="/wishlist/item/:id" element={<WishlistDetail />} />
              <Route path="/wishlist/move/:id" element={<AddEditItem mode="move" />} />
              <Route path="/guide" element={<Guide />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </AppErrorBoundary>
    </LanguageProvider>
  );
}

export default App;
