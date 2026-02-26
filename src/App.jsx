import { useState } from 'react'
import { supabase } from './lib/supabaseClient'

function App() {
  const [recipes, setRecipes] = useState([])

  const loadRecipes = async () => {
    try {
      const { data, error } = await supabase.from('Recipes').select('*')
      if (error) throw error
      setRecipes(data ?? [])
    } catch (err) {
      console.error('Could not load recipes:', err)
      setRecipes([])
    }
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <h1>Recipe Meal Planner</h1>
      <button onClick={loadRecipes}>Load recipes table</button>
      <p>Total recipes: {recipes.length}</p>

      {recipes.length > 0 && (
        <pre style={{ textAlign: 'left', marginTop: '1rem' }}>
          {JSON.stringify(recipes, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default App
