import { useState, useEffect, createContext, useContext } from 'react';
import { bookApi } from '../api/bookApi';

export const BookContext = createContext();

export const BookProvider = ({ children }) => {
  const [books, setBooks] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBooks = async (params = {}) => {
    try {
      setLoading(true);

      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined)
      );

      const data = await bookApi.getBooks(cleanParams);
      setBooks(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const data = await bookApi.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch book analytics:', err);
    }
  };

  const addBook = async (book, defaultStatus = 'watched') => {
    await bookApi.addBook({ ...book, status: book.status || defaultStatus });
    await fetchBooks();
    await fetchAnalytics();
  };

  const updateBook = async (id, book) => {
    await bookApi.updateBook(id, book);
    await fetchBooks();
    await fetchAnalytics();
  };

  const updateBookStatus = async (id, status) => {
    const p = books.find((x) => x.id === id);
    if (!p) return;
    await updateBook(id, { ...p, status });
  };

  const deleteBook = async (id) => {
    await bookApi.deleteBook(id);
    await fetchBooks();
    await fetchAnalytics();
  };

  useEffect(() => {
    fetchBooks();
    fetchAnalytics();
  }, []);

  return (
    <BookContext.Provider value={{
      books,
      analytics,
      loading,
      error,
      fetchBooks,
      addBook,
      updateBook,
      updateBookStatus,
      deleteBook,
    }}>
      {children}
    </BookContext.Provider>
  );
};

export const useBooks = () => {
  const context = useContext(BookContext);
  if (!context) {
    throw new Error('useBooks must be used within a BookProvider');
  }
  return context;
};
