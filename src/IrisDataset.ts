export const irisData = [
  { sepalLength: 5.1, sepalWidth: 3.5, petalLength: 1.4, petalWidth: 0.2, leafLength: 7.2, leafWidth: 3.1, leafThickness: 0.22, species: 'setosa' },
  { sepalLength: 4.9, sepalWidth: 3.0, petalLength: 1.4, petalWidth: 0.2, leafLength: 6.8, leafWidth: 2.9, leafThickness: 0.21, species: 'setosa' },
  { sepalLength: 4.7, sepalWidth: 3.2, petalLength: 1.3, petalWidth: 0.2, leafLength: 6.5, leafWidth: 2.8, leafThickness: 0.20, species: 'setosa' },
  { sepalLength: 4.6, sepalWidth: 3.1, petalLength: 1.5, petalWidth: 0.2, leafLength: 6.4, leafWidth: 2.7, leafThickness: 0.23, species: 'setosa' },
  { sepalLength: 5.0, sepalWidth: 3.6, petalLength: 1.4, petalWidth: 0.2, leafLength: 7.5, leafWidth: 3.3, leafThickness: 0.24, species: 'setosa' },
  { sepalLength: 7.0, sepalWidth: 3.2, petalLength: 4.7, petalWidth: 1.4, leafLength: 14.2, leafWidth: 4.5, leafThickness: 0.42, species: 'versicolor' },
  { sepalLength: 6.4, sepalWidth: 3.2, petalLength: 4.5, petalWidth: 1.5, leafLength: 13.8, leafWidth: 4.3, leafThickness: 0.40, species: 'versicolor' },
  { sepalLength: 6.9, sepalWidth: 3.1, petalLength: 4.9, petalWidth: 1.5, leafLength: 15.1, leafWidth: 4.8, leafThickness: 0.45, species: 'versicolor' },
  { sepalLength: 5.5, sepalWidth: 2.3, petalLength: 4.0, petalWidth: 1.3, leafLength: 12.5, leafWidth: 3.9, leafThickness: 0.38, species: 'versicolor' },
  { sepalLength: 6.5, sepalWidth: 2.8, petalLength: 4.6, petalWidth: 1.5, leafLength: 14.0, leafWidth: 4.4, leafThickness: 0.41, species: 'versicolor' },
  { sepalLength: 6.3, sepalWidth: 3.3, petalLength: 6.0, petalWidth: 2.5, leafLength: 21.5, leafWidth: 6.2, leafThickness: 0.65, species: 'virginica' },
  { sepalLength: 5.8, sepalWidth: 2.7, petalLength: 5.1, petalWidth: 1.9, leafLength: 19.8, leafWidth: 5.8, leafThickness: 0.60, species: 'virginica' },
  { sepalLength: 7.1, sepalWidth: 3.0, petalLength: 5.9, petalWidth: 2.1, leafLength: 23.4, leafWidth: 6.8, leafThickness: 0.72, species: 'virginica' },
  { sepalLength: 6.3, sepalWidth: 2.9, petalLength: 5.6, petalWidth: 1.8, leafLength: 20.2, leafWidth: 6.0, leafThickness: 0.62, species: 'virginica' },
  { sepalLength: 6.5, sepalWidth: 3.0, petalLength: 5.8, petalWidth: 2.2, leafLength: 22.1, leafWidth: 6.5, leafThickness: 0.68, species: 'virginica' }
];

export const processSpeciesMeans = () => {
  const means: Record<string, any> = {};
  const counts: Record<string, number> = {};
  
  irisData.forEach(d => {
    if (!means[d.species]) {
      means[d.species] = { 
        sepalLength: 0, sepalWidth: 0, 
        petalLength: 0, petalWidth: 0,
        leafLength: 0, leafWidth: 0,
        leafThickness: 0
      };
      counts[d.species] = 0;
    }
    means[d.species].sepalLength += d.sepalLength;
    means[d.species].sepalWidth += d.sepalWidth;
    means[d.species].petalLength += d.petalLength;
    means[d.species].petalWidth += d.petalWidth;
    means[d.species].leafLength += (d as any).leafLength || 0;
    means[d.species].leafWidth += (d as any).leafWidth || 0;
    means[d.species].leafThickness += d.leafThickness;
    counts[d.species] += 1;
  });

  return Object.keys(means).map(species => ({
    species,
    sepalLength: Number((means[species].sepalLength / counts[species]).toFixed(2)),
    sepalWidth: Number((means[species].sepalWidth / counts[species]).toFixed(2)),
    petalLength: Number((means[species].petalLength / counts[species]).toFixed(2)),
    petalWidth: Number((means[species].petalWidth / counts[species]).toFixed(2)),
    leafLength: Number((means[species].leafLength / counts[species]).toFixed(2)),
    leafWidth: Number((means[species].leafWidth / counts[species]).toFixed(2)),
    leafThickness: Number((means[species].leafThickness / counts[species]).toFixed(2))
  }));
};
