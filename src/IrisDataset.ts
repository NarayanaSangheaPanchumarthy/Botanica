export const irisData = [
  { sepalLength: 5.1, sepalWidth: 3.5, petalLength: 1.4, petalWidth: 0.2, species: 'setosa' },
  { sepalLength: 4.9, sepalWidth: 3.0, petalLength: 1.4, petalWidth: 0.2, species: 'setosa' },
  { sepalLength: 4.7, sepalWidth: 3.2, petalLength: 1.3, petalWidth: 0.2, species: 'setosa' },
  { sepalLength: 4.6, sepalWidth: 3.1, petalLength: 1.5, petalWidth: 0.2, species: 'setosa' },
  { sepalLength: 5.0, sepalWidth: 3.6, petalLength: 1.4, petalWidth: 0.2, species: 'setosa' },
  { sepalLength: 7.0, sepalWidth: 3.2, petalLength: 4.7, petalWidth: 1.4, species: 'versicolor' },
  { sepalLength: 6.4, sepalWidth: 3.2, petalLength: 4.5, petalWidth: 1.5, species: 'versicolor' },
  { sepalLength: 6.9, sepalWidth: 3.1, petalLength: 4.9, petalWidth: 1.5, species: 'versicolor' },
  { sepalLength: 5.5, sepalWidth: 2.3, petalLength: 4.0, petalWidth: 1.3, species: 'versicolor' },
  { sepalLength: 6.5, sepalWidth: 2.8, petalLength: 4.6, petalWidth: 1.5, species: 'versicolor' },
  { sepalLength: 6.3, sepalWidth: 3.3, petalLength: 6.0, petalWidth: 2.5, species: 'virginica' },
  { sepalLength: 5.8, sepalWidth: 2.7, petalLength: 5.1, petalWidth: 1.9, species: 'virginica' },
  { sepalLength: 7.1, sepalWidth: 3.0, petalLength: 5.9, petalWidth: 2.1, species: 'virginica' },
  { sepalLength: 6.3, sepalWidth: 2.9, petalLength: 5.6, petalWidth: 1.8, species: 'virginica' },
  { sepalLength: 6.5, sepalWidth: 3.0, petalLength: 5.8, petalWidth: 2.2, species: 'virginica' }
];

export const processSpeciesMeans = () => {
  const means: Record<string, any> = {};
  const counts: Record<string, number> = {};
  
  irisData.forEach(d => {
    if (!means[d.species]) {
      means[d.species] = { sepalLength: 0, sepalWidth: 0, petalLength: 0, petalWidth: 0 };
      counts[d.species] = 0;
    }
    means[d.species].sepalLength += d.sepalLength;
    means[d.species].sepalWidth += d.sepalWidth;
    means[d.species].petalLength += d.petalLength;
    means[d.species].petalWidth += d.petalWidth;
    counts[d.species] += 1;
  });

  return Object.keys(means).map(species => ({
    species,
    sepalLength: Number((means[species].sepalLength / counts[species]).toFixed(2)),
    sepalWidth: Number((means[species].sepalWidth / counts[species]).toFixed(2)),
    petalLength: Number((means[species].petalLength / counts[species]).toFixed(2)),
    petalWidth: Number((means[species].petalWidth / counts[species]).toFixed(2))
  }));
};
