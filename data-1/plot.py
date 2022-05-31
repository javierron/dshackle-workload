# import the required library 
import pandas as pd 
import matplotlib.pyplot as plt 
  
  
# load the dataset
df = pd.read_csv("block-read-besu-cache.csv")
df.columns = ["method", "block_number", "latency"]
  
# display 5 rows of dataset
print( df.head())

df.boxplot(by ='method', column =['latency'], grid = False)